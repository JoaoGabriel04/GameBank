import { withLock } from "../../../middleware/lock.middleware.js";
import { emitToRoom } from "../../../lib/socket.js";
import { sessionLogger } from "../../../lib/logger.js";
import { mapa2dRepository } from "../mapa2d.repository.js";
import { economiaMapa2DService } from "./economia.service.js";
import { timerMapa2DService } from "./timer.service.js";
import {
  CUSTO_POR_SLOT,
  MANUTENCAO_PCT_N1,
  MESES_GRACA_FALENCIA,
  MESES_TOTAIS,
  SLOTS_CONSTRUCAO,
} from "../../../constants/economiaMapa2D.js";

class FechamentoMapa2DService {
  /**
   * Fecha o mês corrente: avalia ocupação/aluguel de cada construção,
   * cobra manutenção, IPTU e imposto progressivo, verifica falência, e
   * avança para o mês seguinte (ou encerra a partida).
   *
   * `esperadoFecharMesEm` (opcional): quando vindo de um timer agendado,
   * ignora a execução se o fecharMesEm já mudou desde o agendamento —
   * mesma idempotência do timer de turno do Modo Tabuleiro (evita duplo
   * processamento quando timer em memória e varredura periódica disparam
   * quase ao mesmo tempo).
   */
  async fecharMes(sessionId: number, esperadoFecharMesEm?: string) {
    return withLock(`mapa2d:${sessionId}`, async () => {
      const session = await mapa2dRepository.findSessionAtiva(sessionId);
      if (!session) return null;

      if (esperadoFecharMesEm && session.fecharMesEm?.toISOString() !== esperadoFecharMesEm) {
        sessionLogger.info(
          { sessionId, esperado: esperadoFecharMesEm, atual: session.fecharMesEm },
          "fecharMes (mapa2d) ignorado — mês já foi fechado por outro caminho"
        );
        return { fechou: false, motivo: "mês já fechado" };
      }

      const resumoPorJogador = new Map<number, { aluguelRecebido: number; manutencaoPaga: number; impostos: number }>();
      const inicializarResumo = (playerId: number) => {
        if (!resumoPorJogador.has(playerId)) {
          resumoPorJogador.set(playerId, { aluguelRecebido: 0, manutencaoPaga: 0, impostos: 0 });
        }
        return resumoPorJogador.get(playerId)!;
      };

      // ── Aluguéis e manutenção ──────────────────────────────────────────
      const construcoes = await mapa2dRepository.findConstrucoesComDono(sessionId);
      for (const c of construcoes) {
        const donoId = c.sessionTerreno.donoId;
        if (!donoId) continue;

        const recomendado = economiaMapa2DService.calcularAluguelRecomendado(
          c.sessionTerreno.terreno.multiplicador,
          c.tipo
        );
        const ocupa = economiaMapa2DService.calcularOcupacao(
          c.aluguelPedido,
          recomendado,
          c.sessionTerreno.terreno.categoria
        );
        const custoConstrucao = SLOTS_CONSTRUCAO[c.tipo] * CUSTO_POR_SLOT;
        const manutencao = Math.round(custoConstrucao * MANUTENCAO_PCT_N1);

        const resumo = inicializarResumo(donoId);
        if (ocupa) {
          await mapa2dRepository.updatePlayerSaldo(donoId, c.aluguelPedido - manutencao);
          resumo.aluguelRecebido += c.aluguelPedido;
        } else {
          await mapa2dRepository.updatePlayerSaldo(donoId, -manutencao);
        }
        resumo.manutencaoPaga += manutencao;

        await this.repoUpdateOcupacao(c.id, ocupa);
      }

      // ── Impostos e falência ─────────────────────────────────────────────
      const players = await mapa2dRepository.findPlayersAtivos(sessionId);
      for (const p of players) {
        const resumo = inicializarResumo(p.id);
        const terrenos = await mapa2dRepository.findSessionTerrenosComDono(sessionId, p.id);

        let iptuTotal = 0;
        for (const st of terrenos) {
          if (st.precoPago != null) iptuTotal += economiaMapa2DService.calcularIptu(st.precoPago);
        }

        const ativos = await economiaMapa2DService.calcularAtivos(sessionId, p.id);
        const impostoProgressivo = economiaMapa2DService.calcularImpostoProgressivo(ativos);
        const totalImposto = iptuTotal + impostoProgressivo;
        resumo.impostos += totalImposto;

        await mapa2dRepository.updatePlayerSaldo(p.id, -totalImposto);

        await this.verificarFalencia(sessionId, p.id);
      }

      // ── Vira o mês ──────────────────────────────────────────────────────
      const novoMes = session.rodadaAtual + 1;
      await mapa2dRepository.updateSession(sessionId, { rodadaAtual: novoMes });

      const colapso = await this.colapsoPopulacional(sessionId);
      if (novoMes > MESES_TOTAIS || colapso) {
        const { mapa2dService } = await import("../mapa2d.service.js");
        return mapa2dService.encerrarPartida(sessionId);
      }

      await timerMapa2DService.agendarFechamento(sessionId);

      const resumo = Object.fromEntries(resumoPorJogador);
      emitToRoom(sessionId, "mapa2d:mes_fechado", { mesAtual: novoMes, resumoPorJogador: resumo });

      return { fechou: true, mesAtual: novoMes };
    });
  }

  private async repoUpdateOcupacao(construcaoId: number, ocupado: boolean) {
    const { prisma } = await import("../../../lib/prisma.js");
    await prisma.construcao.update({ where: { id: construcaoId }, data: { ocupado } });
  }

  private async verificarFalencia(sessionId: number, playerId: number) {
    const player = await mapa2dRepository.findPlayer(playerId);
    if (!player || player.desistiu) return;

    if (player.saldo >= 0) {
      // Mês fechou no azul: quita a dívida em aberto (se houver) com o
      // saldo disponível e zera o contador de meses consecutivos devendo
      // — a falência pune INSOLVÊNCIA CONSECUTIVA, não o histórico de dívida.
      const debt = await mapa2dRepository.findDebtAberta(sessionId, playerId);
      if (debt) {
        const { prisma } = await import("../../../lib/prisma.js");
        const abate = Math.min(player.saldo, debt.valor);
        const quitada = abate >= debt.valor;
        await prisma.$transaction([
          quitada
            ? prisma.debt.update({ where: { id: debt.id }, data: { pago: true, paidAt: new Date() } })
            : prisma.debt.update({ where: { id: debt.id }, data: { valor: { decrement: abate } } }),
          prisma.sessionPlayer.update({ where: { id: playerId }, data: { saldo: { decrement: abate } } }),
        ]);
      }
      if (player.rodadasDevendo !== 0) {
        await mapa2dRepository.updatePlayerRodadasDevendo(playerId, 0);
      }
      return;
    }

    // Saldo negativo: mês insuficiente — cria/atualiza dívida e conta mais
    // um mês consecutivo de graça (limite: MESES_GRACA_FALENCIA).
    const valorDevido = -player.saldo;
    const debt = await mapa2dRepository.findDebtAberta(sessionId, playerId);
    if (debt) {
      await mapa2dRepository.incrementarDebt(debt.id, valorDevido);
    } else {
      await mapa2dRepository.criarDebt(sessionId, playerId, valorDevido, "Saldo negativo no fechamento de mês (Mapa 2D)");
    }

    const rodadas = (player.rodadasDevendo ?? 0) + 1;

    if (rodadas > MESES_GRACA_FALENCIA) {
      await mapa2dRepository.liberarTerrenosDoJogador(sessionId, playerId);
      await mapa2dRepository.removerConstrucoesDoJogador(sessionId, playerId);
      await mapa2dRepository.marcarFalido(playerId);

      await mapa2dRepository.criarHistorico(
        sessionId,
        "MAPA2D_FALENCIA",
        `${player.nome} faliu — dívida de R$ ${valorDevido} superou o patrimônio.`
      );
      emitToRoom(sessionId, "mapa2d:falencia", { playerId });
      return;
    }

    await mapa2dRepository.updatePlayerRodadasDevendo(playerId, rodadas);
  }

  private async colapsoPopulacional(sessionId: number): Promise<boolean> {
    const players = await mapa2dRepository.findPlayers(sessionId);
    const ativos = players.filter((p) => !p.desistiu);
    return ativos.length <= Math.floor(players.length / 2);
  }
}

export const fechamentoMapa2DService = new FechamentoMapa2DService();
