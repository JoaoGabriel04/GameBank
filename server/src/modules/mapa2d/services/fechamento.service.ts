import { withLock } from "../../../middleware/lock.middleware.js";
import { emitToRoom } from "../../../lib/socket.js";
import { sessionLogger } from "../../../lib/logger.js";
import { mapa2dRepository } from "../mapa2d.repository.js";
import { economiaMapa2DService } from "./economia.service.js";
import { timerMapa2DService } from "./timer.service.js";
import { EVENTO_MAPA2D_INTERVALO_MESES, getEventoMapa2D, sortearEventoMapa2D } from "../../../constants/eventosMapa2D.js";
import {
  CUSTO_POR_SLOT,
  EMPRESTIMO_MAPA2D_JUROS_PCT,
  MANUTENCAO_PCT_N1,
  MESES_GRACA_FALENCIA,
  MESES_TOTAIS,
  REPUTACAO_GANHO_PRECO_JUSTO,
  REPUTACAO_MAX,
  REPUTACAO_MIN,
  REPUTACAO_PERDA_ATRASO,
  REPUTACAO_PERDA_FALENCIA,
  REPUTACAO_PERDA_PRECO_ABUSIVO,
  REPUTACAO_PERDA_VACANCIA_NEGLIGENTE,
  SLOTS_CONSTRUCAO,
  sensibilidadeRegiao,
} from "../../../constants/economiaMapa2D.js";

type ReputacaoContexto = {
  temConstrucaoPrecoJusto: boolean;
  temConstrucaoPrecoAbusivo: boolean;
  vagaPorNegligencia: boolean;
  estaDevendo: boolean;
};

class FechamentoMapa2DService {
  /**
   * Fecha o mês corrente: avalia ocupação/aluguel de cada construção,
   * cobra manutenção, IPTU e imposto progressivo, aplica juros de
   * empréstimo, atualiza Reputação, verifica falência, e avança para o
   * mês seguinte (virando também o evento econômico).
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

      // Evento vigente durante o mês que está fechando agora (o próximo
      // evento, se houver, só passa a valer depois que o mês virar).
      const eventoDoMes = getEventoMapa2D(session.eventoAtual);
      const mercadoMult = eventoDoMes?.efeito.mercadoMult ?? 1.0;

      const resumoPorJogador = new Map<number, { aluguelRecebido: number; manutencaoPaga: number; impostos: number }>();
      const inicializarResumo = (playerId: number) => {
        if (!resumoPorJogador.has(playerId)) {
          resumoPorJogador.set(playerId, { aluguelRecebido: 0, manutencaoPaga: 0, impostos: 0 });
        }
        return resumoPorJogador.get(playerId)!;
      };

      const contextoReputacao = new Map<number, ReputacaoContexto>();
      const inicializarContexto = (playerId: number) => {
        if (!contextoReputacao.has(playerId)) {
          contextoReputacao.set(playerId, {
            temConstrucaoPrecoJusto: false,
            temConstrucaoPrecoAbusivo: false,
            vagaPorNegligencia: false,
            estaDevendo: false,
          });
        }
        return contextoReputacao.get(playerId)!;
      };

      const todosJogadores = await mapa2dRepository.findPlayers(sessionId);
      const reputacaoPorJogador = new Map(todosJogadores.map((p) => [p.id, p.reputacao]));

      // ── Aluguéis e manutenção (por nível, moduladas pelo evento vigente) ─
      const construcoes = await mapa2dRepository.findConstrucoesComDono(sessionId);
      for (const c of construcoes) {
        const donoId = c.sessionTerreno.donoId;
        if (!donoId) continue;

        const reputacaoDono = reputacaoPorJogador.get(donoId) ?? 3.0;

        const recomendadoN1 = economiaMapa2DService.calcularAluguelRecomendado(
          c.sessionTerreno.terreno.multiplicador,
          c.tipo,
          mercadoMult,
          session.inflacaoAcumuladaMapa2D
        );
        const recomendado = economiaMapa2DService.aluguelNoNivel(recomendadoN1, c.nivel);

        const ocupa = economiaMapa2DService.calcularOcupacao(
          c.aluguelPedido,
          recomendado,
          c.sessionTerreno.terreno.categoria,
          reputacaoDono
        );

        const custoConstrucaoN1 = SLOTS_CONSTRUCAO[c.tipo] * CUSTO_POR_SLOT;
        const manutencaoN1 = Math.round(custoConstrucaoN1 * MANUTENCAO_PCT_N1);
        const manutencao = economiaMapa2DService.manutencaoNoNivel(manutencaoN1, c.nivel, c.sessionTerreno.terreno.multiplicador);

        const resumo = inicializarResumo(donoId);
        if (ocupa) {
          await mapa2dRepository.updatePlayerSaldo(donoId, c.aluguelPedido - manutencao);
          resumo.aluguelRecebido += c.aluguelPedido;
        } else {
          await mapa2dRepository.updatePlayerSaldo(donoId, -manutencao);
        }
        resumo.manutencaoPaga += manutencao;

        await this.repoUpdateOcupacao(c.id, ocupa);

        // Comportamento de precificação, agregado por jogador (OU lógico —
        // um único imóvel abusivo/negligente já conta, uma vez por mês,
        // independente de quantos imóveis o jogador tenha).
        const ctx = inicializarContexto(donoId);
        const sens = sensibilidadeRegiao(c.sessionTerreno.terreno.categoria);
        const razao = recomendado > 0 ? c.aluguelPedido / recomendado : 0;
        if (c.aluguelPedido <= recomendado) ctx.temConstrucaoPrecoJusto = true;
        if (razao >= 1 + sens) ctx.temConstrucaoPrecoAbusivo = true;
        if (!ocupa && c.aluguelPedido > recomendado) ctx.vagaPorNegligencia = true;
      }

      // ── Impostos, juros de empréstimo, falência e Reputação ─────────────
      const jurosPct = EMPRESTIMO_MAPA2D_JUROS_PCT * (eventoDoMes?.efeito.jurosMult ?? 1.0);
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

        // Juros compostos do empréstimo — aplicados ANTES da checagem de
        // falência (para que a dívida crescida já reflita na avaliação do mês).
        const emprestimo = await mapa2dRepository.findEmprestimoAtivo(sessionId, p.id);
        if (emprestimo) {
          const novoDevido = Math.round(emprestimo.valorDevido * (1 + jurosPct));
          await mapa2dRepository.atualizarEmprestimoDevido(emprestimo.id, novoDevido);
        }

        await this.verificarFalencia(sessionId, p.id);

        const ctx = inicializarContexto(p.id);
        const atual = await mapa2dRepository.findPlayer(p.id);
        ctx.estaDevendo = (atual?.rodadasDevendo ?? 0) > 0;
        await this.atualizarReputacao(p.id, ctx);
      }

      // ── Vira o mês e o evento econômico ──────────────────────────────────
      const novoMes = session.rodadaAtual + 1;
      const eventoAtivo = session.eventoProximo; // anunciado no fechamento anterior, ativa agora
      const proximaTemEvento = (novoMes + 1) % EVENTO_MAPA2D_INTERVALO_MESES === 0;
      const eventoProximo = proximaTemEvento ? sortearEventoMapa2D(eventoAtivo).codigo : null;

      await mapa2dRepository.updateSession(sessionId, {
        rodadaAtual: novoMes,
        eventoAtual: eventoAtivo,
        eventoProximo,
      });

      const defRecemAtivado = getEventoMapa2D(eventoAtivo);
      if (defRecemAtivado?.efeito.inflacaoIncremento) {
        await mapa2dRepository.incrementarInflacaoAcumulada(sessionId, defRecemAtivado.efeito.inflacaoIncremento);
      }

      const colapso = await this.colapsoPopulacional(sessionId);
      if (novoMes > MESES_TOTAIS || colapso) {
        const { mapa2dService } = await import("../mapa2d.service.js");
        return mapa2dService.encerrarPartida(sessionId);
      }

      await timerMapa2DService.agendarFechamento(sessionId);

      const resumo = Object.fromEntries(resumoPorJogador);
      emitToRoom(sessionId, "mapa2d:mes_fechado", { mesAtual: novoMes, resumoPorJogador: resumo, eventoAtivo, eventoProximo });

      return { fechou: true, mesAtual: novoMes };
    });
  }

  private async repoUpdateOcupacao(construcaoId: number, ocupado: boolean) {
    const { prisma } = await import("../../../lib/prisma.js");
    await prisma.construcao.update({ where: { id: construcaoId }, data: { ocupado } });
  }

  /** Reputação — modula a tolerância de ocupação e o desempate de vitória (GDD Seção 5). */
  private async atualizarReputacao(playerId: number, contexto: ReputacaoContexto) {
    const player = await mapa2dRepository.findPlayer(playerId);
    // Falência já aplica sua própria penalidade dentro de verificarFalencia
    // — não soma o comportamento do mês a um jogador que acabou de sair.
    if (!player || player.desistiu) return;

    let rep = player.reputacao;
    if (contexto.temConstrucaoPrecoJusto) rep += REPUTACAO_GANHO_PRECO_JUSTO;
    if (contexto.temConstrucaoPrecoAbusivo) rep -= REPUTACAO_PERDA_PRECO_ABUSIVO;
    if (contexto.vagaPorNegligencia) rep -= REPUTACAO_PERDA_VACANCIA_NEGLIGENTE;
    if (contexto.estaDevendo) rep -= REPUTACAO_PERDA_ATRASO;

    rep = Math.max(REPUTACAO_MIN, Math.min(REPUTACAO_MAX, rep));
    await mapa2dRepository.updatePlayerReputacao(playerId, rep);
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
      // ── ORDEM CRÍTICA — a garantia do EmprestimoMapa é executada ANTES
      // de liberarTerrenosDoJogador rodar. liberarTerrenosDoJogador devolve
      // TODOS os terrenos do jogador ao banco, inclusive o dado em garantia
      // — a execução explícita aqui registra que o banco tomou o ativo por
      // inadimplência, e não apenas "devolveu tudo junto" na falência.
      const emprestimo = await mapa2dRepository.findEmprestimoAtivo(sessionId, playerId);
      if (emprestimo) {
        await mapa2dRepository.marcarEmprestimoExecutado(emprestimo.id);
        await mapa2dRepository.criarHistorico(
          sessionId,
          "MAPA2D_GARANTIA_EXECUTADA",
          `Garantia executada: construção do empréstimo não pago tomada pelo banco.`
        );
      }

      await mapa2dRepository.liberarTerrenosDoJogador(sessionId, playerId);
      await mapa2dRepository.removerConstrucoesDoJogador(sessionId, playerId);
      await mapa2dRepository.marcarFalido(playerId);

      await mapa2dRepository.updatePlayerReputacao(
        playerId,
        Math.max(REPUTACAO_MIN, player.reputacao - REPUTACAO_PERDA_FALENCIA)
      );

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
