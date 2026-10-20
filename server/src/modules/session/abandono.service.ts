import { getIO } from "../../lib/socket.js";
import { prisma } from "../../lib/prisma.js";
import { sessionLogger } from "../../lib/logger.js";
import { withLock } from "../../middleware/lock.middleware.js";
import { SALA_ABANDONADA_MS } from "../../constants/sessao.js";
import { cancelTurnoTimer } from "../turno/services/timer.service.js";
import { cancelLeilaoTimer } from "../leilao/leilao.service.js";
import { clearSessionDeck } from "../carta/carta.repository.js";
import { emitSessionClosed } from "../socket/socket.handler.js";
import { SessionRepository } from "./session.repository.js";
import { SessionService, apagarDadosDaSessao } from "./session.service.js";

// Salas "Em Andamento" sem ninguém conectado. Os timers de turno jogam
// pelos ausentes, então uma sala abandonada roda para sempre, gerando
// queries, histórico e broadcasts. Depois de SALA_ABANDONADA_MS vazia, a
// sala é encerrada SEM recompensas (moedas, XP, troféus, missões, baús):
// uma partida jogada pelos timers não pode render nada.
//
// "Conectado" = socket na sala de um jogador ativo ou do dono (no Modo
// Banca o dono opera os jogadores sem conta). Espectadores não contam.
// O Mapa 2D fica de fora enquanto está em desenvolvimento.

const VARREDURA_MIN_INTERVALO_MS = 60_000;

class AbandonoService {
  private repo = new SessionRepository();
  private sessionService = new SessionService();
  // sessionId → desde quando a sala está vazia (por instância; recomeça
  // a contar após um restart, o que só atrasa o encerramento).
  readonly vaziaDesde = new Map<number, number>();
  private ultimaVarredura = 0;

  async varrerSalasAbandonadas(agora = Date.now()) {
    if (agora - this.ultimaVarredura < VARREDURA_MIN_INTERVALO_MS) return;
    this.ultimaVarredura = agora;

    const salas = await this.repo.findEmAndamentoParaAbandono();
    const abertas = new Set(salas.map((s) => s.id));
    for (const id of this.vaziaDesde.keys()) if (!abertas.has(id)) this.vaziaDesde.delete(id);

    for (const sala of salas) {
      const conectados = await this.contarConectados(sala.id, sala.ownerId, sala.jogadores.map((j) => j.id));
      if (conectados === null) continue; // presença desconhecida: não arrisca
      if (conectados > 0) {
        this.vaziaDesde.delete(sala.id);
        continue;
      }

      const desde = this.vaziaDesde.get(sala.id) ?? agora;
      this.vaziaDesde.set(sala.id, desde);
      if (agora - desde < SALA_ABANDONADA_MS) continue;

      await this.encerrarPorAbandono(sala.id, agora - desde).catch((err) => {
        // 423 = lock ocupado: alguém está agindo na sala; tenta na próxima.
        if (err?.statusCode !== 423) sessionLogger.error({ err, sessionId: sala.id }, "erro ao encerrar sala abandonada");
      });
    }
  }

  /** Jogadores ativos (ou o dono) com socket na sala; null se não deu para saber. */
  async contarConectados(sessionId: number, ownerId: number | null, jogadoresAtivos: number[]) {
    try {
      const ativos = new Set(jogadoresAtivos);
      const sockets = await getIO().of("/game").in(`session:${sessionId}`).fetchSockets();
      return sockets.filter((s) =>
        (s.data.playerId != null && ativos.has(s.data.playerId)) ||
        (ownerId != null && s.data.userId === ownerId)
      ).length;
    } catch (err) {
      sessionLogger.warn({ err, sessionId }, "presença da sala indisponível — abandono não avaliado");
      return null;
    }
  }

  /**
   * Encerra a sala sem recompensas. Pega os locks da sessão e do turno (na
   * mesma ordem de sair/expulsar) e reconfere status e presença lá dentro:
   * um jogador que reconectou desde a varredura mantém a sala aberta.
   */
  async encerrarPorAbandono(sessionId: number, vaziaHaMs: number) {
    return withLock(`session:${sessionId}`, () =>
      withLock(`turno:${sessionId}`, async () => {
        const sala = await prisma.session.findUnique({
          where: { id: sessionId },
          select: {
            status: true, ownerId: true, tipoJogo: true, rodadaAtual: true,
            jogadores: { where: { desistiu: false }, select: { id: true } },
          },
        });
        if (!sala || sala.status !== "Em Andamento") {
          this.vaziaDesde.delete(sessionId);
          return false;
        }
        const conectados = await this.contarConectados(sessionId, sala.ownerId, sala.jogadores.map((j) => j.id));
        if (conectados !== 0) {
          if (conectados !== null) this.vaziaDesde.delete(sessionId);
          return false;
        }

        cancelTurnoTimer(sessionId);
        cancelLeilaoTimer(sessionId);
        clearSessionDeck(sessionId);
        await prisma.$transaction((tx) => apagarDadosDaSessao(tx, sessionId));
        await this.sessionService.invalidateCache(sessionId);
        this.vaziaDesde.delete(sessionId);

        sessionLogger.warn(
          {
            sessionId,
            tipoJogo: sala.tipoJogo,
            rodada: sala.rodadaAtual,
            jogadoresAtivos: sala.jogadores.length,
            vaziaHaMin: Math.round(vaziaHaMs / 60_000),
          },
          "sala abandonada encerrada sem recompensas"
        );
        // Ninguém na sala, mas quem abrir a tela agora recebe o fechamento.
        emitSessionClosed(sessionId);
        return true;
      })
    );
  }
}

export const abandonoService = new AbandonoService();
