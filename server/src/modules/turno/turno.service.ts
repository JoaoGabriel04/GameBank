import { AppError } from "../../middleware/error-handler.middleware.js";
import { withLock } from "../../middleware/lock.middleware.js";
import { turnoRepository } from "./turno.repository.js";
import { sessionLogger } from "../../lib/logger.js";

const TURNO_TIMEOUT_MS = 60_000;

// Timers de turno em memória por sessionId. Como o dado é transitório
// (só importa "há um timer pendente agora") e a app roda como instância
// única no Render, não precisa de Redis — mesmo padrão de fallback em
// memória já usado em socket.ts (activeSockets).
const turnoTimers = new Map<number, NodeJS.Timeout>();

function cancelTurnoTimer(sessionId: number) {
  const timer = turnoTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    turnoTimers.delete(sessionId);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function parseOrdem(ordemTurnos: string | null): number[] {
  if (!ordemTurnos) return [];
  try {
    const parsed = JSON.parse(ordemTurnos);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

class TurnoService {
  // Chamado pelo SessionService.startSession quando tipoJogo === "tabuleiro".
  async iniciarTurnos(sessionId: number, jogadorIds: number[]) {
    const ordem = shuffle(jogadorIds);
    const primeiro = ordem[0] ?? null;

    await turnoRepository.updateTurno(sessionId, {
      ordemTurnos: JSON.stringify(ordem),
      turnoAtualPlayerId: primeiro,
      turnoIniciadoEm: primeiro ? new Date() : null,
      aguardandoAcao: false,
    });

    if (primeiro) this.agendarTimeout(sessionId);
    return { ordem, turnoAtualPlayerId: primeiro };
  }

  async passarVez(sessionId: number, playerIdAtual: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);

      if (session.turnoAtualPlayerId !== playerIdAtual) {
        throw new AppError(403, "Não é sua vez de jogar.");
      }

      return this.avancarTurno(sessionId, session);
    });
  }

  // Disparado pelo timeout de 60s — não valida "de quem é a vez" pois é
  // o próprio servidor avançando o turno atual.
  async avancarPorTimeout(sessionId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await turnoRepository.findSessionComJogadores(sessionId);
      if (!session || session.status !== "Em Andamento" || session.tipoJogo !== "tabuleiro") {
        cancelTurnoTimer(sessionId);
        return null;
      }

      // Timer pausa durante decisão obrigatória (ex: escolher o que vender)
      if (session.aguardandoAcao) {
        this.agendarTimeout(sessionId);
        return null;
      }

      return this.avancarTurno(sessionId, session, true);
    });
  }

  private async validarESessaoAtiva(sessionId: number) {
    const session = await turnoRepository.findSessionComJogadores(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");
    if (session.tipoJogo !== "tabuleiro") throw new AppError(400, "Sessão não é do Modo Tabuleiro");
    if (session.status !== "Em Andamento") throw new AppError(400, "Partida não está em andamento");
    return session;
  }

  private async avancarTurno(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    porTimeout = false
  ) {
    const ordem = parseOrdem(session.ordemTurnos);
    if (ordem.length === 0) throw new AppError(400, "Ordem de turnos não definida");

    const jogadoresPorId = new Map(session.jogadores.map(j => [j.id, j]));
    const atualIdx = ordem.indexOf(session.turnoAtualPlayerId ?? -1);

    let proximo: { id: number; pularProximaRodada: boolean } | null = null;
    for (let step = 1; step <= ordem.length; step++) {
      const idx = (atualIdx + step) % ordem.length;
      const candidato = jogadoresPorId.get(ordem[idx]);
      if (!candidato || candidato.desistiu) continue;

      if (candidato.pularProximaRodada) {
        await turnoRepository.clearPularProximaRodada(candidato.id);
        continue; // pula a vez dele, mas ele já não pula a próxima
      }

      proximo = candidato;
      break;
    }

    // Ninguém mais ativo para jogar (edge case — o fluxo normal já
    // encerraria a partida antes disso via votação/falência)
    if (!proximo) {
      cancelTurnoTimer(sessionId);
      return { turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false };
    }

    await turnoRepository.updateTurno(sessionId, {
      turnoAtualPlayerId: proximo.id,
      turnoIniciadoEm: new Date(),
      aguardandoAcao: false,
    });

    this.agendarTimeout(sessionId);

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    if (porTimeout) {
      const { emitTurnoTimeout } = await import("../socket/socket.handler.js");
      emitTurnoTimeout(sessionId, { jogadorAnteriorId: session.turnoAtualPlayerId });
    }

    return { turnoAtualPlayerId: proximo.id, avancou: true };
  }

  private agendarTimeout(sessionId: number) {
    cancelTurnoTimer(sessionId);
    const timer = setTimeout(() => {
      this.avancarPorTimeout(sessionId).catch(err => {
        sessionLogger.error({ err, sessionId }, "erro ao avançar turno por timeout");
      });
    }, TURNO_TIMEOUT_MS);
    turnoTimers.set(sessionId, timer);
  }

  cancelarTimeout(sessionId: number) {
    cancelTurnoTimer(sessionId);
  }
}

export const turnoService = new TurnoService();
