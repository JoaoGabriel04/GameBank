import { turnoRepository } from "../turno.repository.js";
import { TOTAL_CASAS, POS_PRISAO, getCasa } from "../../tabuleiro/tabuleiro.data.js";
import { timerService, duplosConsecutivos } from "./timer.service.js";

class DadosService {
  /** Retorna as 3 opções de movimento com o destino de cada uma. */
  calcularOpcoesMovimento(posAtual: number, dado1: number, dado2: number) {
    const montar = (passos: number, tipo: "dado1" | "dado2" | "soma") => {
      const destino = (posAtual + passos) % TOTAL_CASAS;
      const casa = getCasa(destino);
      return {
        tipo,
        passos,
        destino,
        nomeCasa: casa.nome,
        tipoCasa: casa.tipo,
        passaInicio: (posAtual + passos) >= TOTAL_CASAS,
      };
    };

    return [
      montar(dado1, "dado1"),
      montar(dado2, "dado2"),
      montar(dado1 + dado2, "soma"),
    ];
  }

  // Rola os dados (caso não-prisão): controla duplos consecutivos, decide
  // entre prisão direta (3 duplos seguidos) e o estado normal de escolha
  // de movimento. `session` só é usado para repassar ao avancarTurno do
  // orquestrador no caso de 3 duplos.
  async rolar(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    player: { id: number; posicao: number }
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
    await timerService.agendarTimeout(sessionId);

    const { emitUpdatedSession } = await import("../../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return {
      dado1, dado2, duplo,
      aguardandoEscolha: true,
      opcoes: this.calcularOpcoesMovimento(player.posicao, dado1, dado2),
    };
  }
}

export const dadosService = new DadosService();
