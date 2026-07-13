import { turnoRepository } from "../turno.repository.js";
import { POS_PRISAO } from "../../tabuleiro/tabuleiro.data.js";
import { timerService, duplosConsecutivos } from "./timer.service.js";

class DadosService {
  // Rola os dados (caso não-prisão): controla duplos consecutivos, decide
  // entre prisão direta (3 duplos seguidos) e o estado normal de escolha
  // de movimento. `session` só é usado para repassar ao avancarTurno do
  // orquestrador no caso de 3 duplos.
  //
  // Crédito de Visão: se o jogador tem creditoVisao > 0, os valores dos
  // dados são devolvidos na resposta (ele vê antes de escolher). O crédito
  // é consumido a cada uso. Quando esgota (vai de 1 → 0), agenda recarga
  // para 3 rodadas depois. A recarga é verificada no início da rolagem.
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

    const podeVer = player.creditoVisao > 0;

    if (podeVer) {
      // Consome um crédito
      await turnoRepository.usarCreditoVisao(player.id);
      const creditosRestantes = player.creditoVisao - 1;

      // Se acabaram os créditos, agenda recarga para 3 rodadas à frente.
      if (creditosRestantes === 0) {
        const recargaEm = session.rodadaAtual + 3;
        await turnoRepository.setCreditoRecargaEm(player.id, recargaEm);
      }

      return {
        dado1,
        dado2,
        duplo,
        aguardandoEscolha: true,
        creditosRestantes,
      };
    }

    // Escolha às cegas: o jogador decide dado1/dado2/soma ANTES de saber
    // os valores — devolver dado1/dado2 (ou as opções com destino/casa)
    // aqui deixaria óbvio pra onde cada escolha leva, e ele escolheria a
    // casa mais vantajosa em vez de arriscar no dado. Os valores só saem
    // do banco em escolherMovimentoInterno, depois que a escolha já foi
    // enviada e travada. `duplo` pode ficar visível — não revela posição,
    // só avisa que uma jogada extra está em jogo se ele escolher soma.
    return {
      duplo,
      aguardandoEscolha: true,
      creditosRestantes: 0,
    };
  }
}

export const dadosService = new DadosService();
