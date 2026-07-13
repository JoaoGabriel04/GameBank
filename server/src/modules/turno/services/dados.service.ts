import { turnoRepository } from "../turno.repository.js";
import { POS_PRISAO } from "../../tabuleiro/tabuleiro.data.js";
import { timerService, duplosConsecutivos } from "./timer.service.js";

class DadosService {
  // Rola os dados (caso não-prisão): controla duplos consecutivos, decide
  // entre prisão direta (3 duplos seguidos) e o estado normal de escolha
  // de movimento. `session` só é usado para repassar ao avancarTurno do
  // orquestrador no caso de 3 duplos.
  async rolar(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    player: { id: number; posicao: number; creditoVisao: number; creditoRecargaEm: number }
  ) {
    const dado1 = Math.floor(Math.random() * 6) + 1;
    const dado2 = Math.floor(Math.random() * 6) + 1;
    const duplo = dado1 === dado2;

    const contagemAnterior = duplosConsecutivos.get(player.id) ?? 0;
    const contagemAtual = duplo ? contagemAnterior + 1 : 0;
    duplosConsecutivos.set(player.id, contagemAtual);

    // 3 duplos seguidos → prisão direta, sem oferecer escolha de
    // movimento e sem jogar de novo.
    if (contagemAtual >= 3) {
      duplosConsecutivos.set(player.id, 0);
      await turnoRepository.moverPlayer(player.id, { posicao: POS_PRISAO, emPrisao: true, turnosPrisao: 3 });
      await turnoRepository.registrarDados(sessionId, {
        ultimoDado1: dado1, ultimoDado2: dado2,
        aguardandoAcao: false, aguardandoEscolha: false,
      });

      const { turnoService } = await import("../turno.service.js");
      const avanco = await turnoService.avancarTurno(sessionId, session);
      return { dado1, dado2, duplo: true, foiPreso: true, novaPosicao: POS_PRISAO, passouInicio: false, ...avanco };
    }

    // Guarda os dados e entra em estado de escolha — NÃO move ainda.
    await turnoRepository.registrarDados(sessionId, {
      ultimoDado1: dado1, ultimoDado2: dado2,
      aguardandoAcao: false, aguardandoEscolha: true,
    });

    // Reset do timer: o jogador tem os 60s para escolher o movimento.
    // Nova janela de decisão → novo timestamp, gravado explicitamente
    // (agendarTimeout só lê, nunca regrava turnoIniciadoEm).
    const agoraEscolha = new Date();
    await turnoRepository.updateTurno(sessionId, { turnoIniciadoEm: agoraEscolha });
    await timerService.agendarTimeout(sessionId, agoraEscolha);

    const { emitUpdatedSession } = await import("../../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    // ── Crédito de Visão ────────────────────────────────────────────────
    // Recarrega se a rodada atual já passou do prazo agendado.
    if (player.creditoRecargaEm > 0 && session.rodadaAtual >= player.creditoRecargaEm) {
      await turnoRepository.resetarCreditosVisao(player.id);
      player.creditoVisao = 2;
      player.creditoRecargaEm = 0;
    }

    // Sempre retorna às cegas — o jogador escolhe se quer revelar usando
    // um crédito (endpoint separado revelarDados). Apenas informa quantos
    // créditos ele tem disponíveis.
    return {
      duplo,
      aguardandoEscolha: true,
      creditosRestantes: player.creditoVisao,
    };
  }
}

export const dadosService = new DadosService();
