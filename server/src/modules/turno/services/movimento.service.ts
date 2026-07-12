import { AppError } from "../../../middleware/error-handler.middleware.js";
import { turnoRepository } from "../turno.repository.js";
import { TOTAL_CASAS } from "../../tabuleiro/tabuleiro.data.js";
import type { EventoEfeito } from "../../../constants/eventos.js";
import { economiaService, type ExtratoInicio } from "./economia.service.js";
import { casaResolverService } from "./casa-resolver.service.js";

class MovimentoService {
  // Público, chamado pelo orquestrador (com lock próprio) e pelo
  // timer.service (timeout na escolha de movimento — já dentro do lock de
  // turno, por isso não trava de novo aqui).
  async escolherMovimentoInterno(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    escolha: "dado1" | "dado2" | "soma",
    mods: EventoEfeito,
    porTimeout = false
  ) {
    if (!session.aguardandoEscolha) {
      throw new AppError(400, "Não há escolha de movimento pendente.");
    }

    const playerId = session.turnoAtualPlayerId;
    if (!playerId) throw new AppError(400, "Nenhum jogador na vez.");

    const dado1 = session.ultimoDado1 ?? 0;
    const dado2 = session.ultimoDado2 ?? 0;
    if (!dado1 || !dado2) throw new AppError(400, "Dados não encontrados.");

    const player = await turnoRepository.findPlayerParaJogada(playerId);
    if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");

    // Quantos passos, conforme a escolha
    const passos = escolha === "dado1" ? dado1
                 : escolha === "dado2" ? dado2
                 : dado1 + dado2;

    const duplo = dado1 === dado2;

    // ── REGRA CRÍTICA: duplo só concede nova jogada se escolher a SOMA ──
    // Senão seria abuso: escolher o dado menor E ainda jogar de novo.
    const duploValido = duplo && escolha === "soma";

    const { duplosConsecutivos, timerService } = await import("./timer.service.js");

    // Se o duplo NÃO for válido (escolheu dado avulso), zera a contagem
    // — não acumula para os 3 duplos.
    if (duplo && !duploValido) {
      duplosConsecutivos.set(playerId, 0);
    }

    // Sai do estado de escolha e entra em resolução
    await turnoRepository.registrarDados(sessionId, {
      aguardandoEscolha: false,
      aguardandoAcao: true,
    });

    const { novaPosicao, passouInicio, resolucao, extratoInicio } =
      await this.moverEResolver(sessionId, player, passos, mods);

    // Avanço do turno: mesma lógica de antes, mas usando duploValido
    // e respeitando encerraVez (feriado/prisão encerram mesmo com duplo)
    const deveEncerrar = (!duploValido || resolucao.encerraVez) && !resolucao.aguardandoAcao;

    if (deveEncerrar) {
      const { turnoService } = await import("../turno.service.js");
      const avanco = await turnoService.avancarTurno(sessionId, session, porTimeout);
      return {
        dado1, dado2, duplo, duploValido, escolha, passos,
        foiPreso: false, novaPosicao, passouInicio,
        ...resolucao, ...avanco, extratoInicio,
      };
    }

    // Duplo válido ou ação pendente: não avança, reseta o timer
    await timerService.agendarTimeout(sessionId);
    const { emitUpdatedSession } = await import("../../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return {
      dado1, dado2, duplo, duploValido, escolha, passos,
      foiPreso: false, novaPosicao, passouInicio,
      ...resolucao, extratoInicio,
    };
  }

  // Move o jogador `total` casas (com crédito de início + extrato de
  // IPTU/manutenção/renda passiva se aplicável) e dispara resolverCasa —
  // compartilhado entre a rolagem normal e a saída (com sucesso ou
  // forçada) da prisão. `mods` vem do orquestrador (ou do timer.service),
  // buscado uma única vez por operação.
  async moverEResolver(
    sessionId: number,
    player: { id: number; nome: string; posicao: number; saldo: number; userId?: number | null },
    total: number,
    mods: EventoEfeito,
    opts?: { creditarInicio?: boolean } // permite suprimir (ex: Vá para Prisão)
  ) {
    const novaPosicao = (player.posicao + total) % TOTAL_CASAS;
    const passouInicio = (player.posicao + total) >= TOTAL_CASAS;
    const deveCreditar = passouInicio && (opts?.creditarInicio ?? true);

    let saldoAtualizado = player.saldo;
    let extrato: ExtratoInicio | null = null;

    // Mover primeiro (posição sempre atualiza)
    await turnoRepository.moverPlayer(player.id, { posicao: novaPosicao });

    if (deveCreditar) {
      extrato = await economiaService.calcularExtratoInicio(sessionId, player.id, mods);

      if (extrato.liquido >= 0) {
        // Saldo positivo: credita direto
        saldoAtualizado = player.saldo + extrato.liquido;
        await turnoRepository.moverPlayer(player.id, { saldo: saldoAtualizado });

        await turnoRepository.criarHistorico({
          sessionId,
          tipo: "PASSAGEM_INICIO",
          detalhes: `${player.nome} passou pelo Início: +R$ ${extrato.creditoInicio} (crédito) ` +
                    `+R$ ${extrato.rendaPassiva} (renda passiva) ` +
                    `−R$ ${extrato.iptu} (IPTU) −R$ ${extrato.manutencao} (manutenção) ` +
                    `= R$ ${extrato.liquido >= 0 ? "+" : ""}${extrato.liquido}`,
        });
      } else {
        // Líquido negativo: credita o que recebe, cobra o que deve.
        // Usa cobrarComFallbackDivida (gera dívida se não tiver saldo, e
        // já integra com a regra de falência em 3 rodadas).
        const aReceber = extrato.creditoInicio + extrato.rendaPassiva;
        const aPagar = extrato.iptu + extrato.manutencao;

        // Credita primeiro
        const saldoComReceita = player.saldo + aReceber;
        await turnoRepository.moverPlayer(player.id, { saldo: saldoComReceita });

        // Depois cobra (pode gerar dívida)
        await economiaService.cobrarComFallbackDivida(
          sessionId,
          { ...player, saldo: saldoComReceita },
          aPagar,
          null, // credor = banco
          `IPTU e manutenção (passagem pelo Início)`
        );

        // Recarrega saldo real após a cobrança
        const atualizado = await turnoRepository.findPlayer(player.id);
        saldoAtualizado = atualizado?.saldo ?? saldoComReceita;
      }

      // Notifica a sala com o extrato — o próprio jogador já recebe o
      // extrato completo na resposta HTTP da rolagem; este evento serve
      // pro toast curto dos demais jogadores.
      const { emitToRoom } = await import("../../../lib/socket.js");
      emitToRoom(sessionId, "inicio:extrato", {
        playerId: player.id,
        playerUserId: player.userId ?? null,
        playerNome: player.nome,
        extrato,
      });
    }

    const resolucao = await casaResolverService.resolverCasa(
      sessionId,
      { ...player, posicao: novaPosicao, saldo: saldoAtualizado },
      total,
      mods
    );

    const { emitUpdatedSession } = await import("../../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return { novaPosicao, passouInicio: deveCreditar, resolucao, extratoInicio: extrato };
  }
}

export const movimentoService = new MovimentoService();
