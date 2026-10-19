import { getIO } from "../../lib/socket.js";
import { emitirOuEnfileirar, enfileirarSnapshot } from "../../lib/fila-de-emits.js";
import { socketLogger } from "../../lib/logger.js";
import { SessionService } from "../session/session.service.js";

const sessionService = new SessionService();

// Evento para a sala da sessão, respeitando a ordem da fila de emits quando
// chamado dentro de um withLock (ver lib/fila-de-emits.ts).
function paraSala(sessionId: number, evento: string, dados: unknown) {
  emitirOuEnfileirar(() => getIO().of("/game").to(`session:${sessionId}`).emit(evento, dados));
}

export interface PlayerUpdateData {
  userId: number;
  badge: string | null;
  badgeImageUrl: string | null;
  banner: string | null;
  frame: string | null;
  frameType: string | null;
  frameAnimated: boolean;
  frameScale: number;
}

// O broadcast não leva o catálogo estático da partida — os dados de cada
// propriedade (sessionPosses[].propriedade) e o tabuleiro: eles só mudam
// entre deploys, já vêm no carregamento REST da sessão e o cliente os
// recompõe (gameStore.applyOrBufferSession). ~14 KB a menos por broadcast.
// Copia em vez de mutar: o mesmo objeto também vira resposta REST.
function semCatalogoEstatico(data: unknown) {
  if (!data || typeof data !== "object") return data;
  const { tabuleiro: _tabuleiro, ...resto } = data as Record<string, unknown>;
  if (Array.isArray(resto.sessionPosses)) {
    resto.sessionPosses = resto.sessionPosses.map(({ propriedade: _propriedade, ...posse }) => posse);
  }
  return resto;
}

// Limites para avisar no log (meta da otimização: broadcast típico < 15 KB).
const BROADCAST_LENTO_MS = 500;
const BROADCAST_GRANDE_BYTES = 30 * 1024;

export function emitSessionUpdated(sessionId: number, data: unknown) {
  paraSala(sessionId, "session:updated", semCatalogoEstatico(data));
}

export function emitSessionClosed(sessionId: number, ranking?: unknown) {
  paraSala(sessionId, "session:closed", { sessionId, ranking });
}

export function emitChatMessage(sessionId: number, data: { id: number; playerId: number; playerNome: string; texto: string; createdAt: string }) {
  paraSala(sessionId, "chat:message", data);
}

export function emitNotificationNew(sessionId: number, data: unknown) {
  paraSala(sessionId, "notification:new", data);
}

export async function emitUpdatedSession(sessionId: number) {
  // Invalida já: leituras REST da mesma requisição precisam ver o estado novo.
  await sessionService.invalidateCache(sessionId);
  // Dentro de um withLock, o broadcast sai uma vez só, no fim do escopo.
  if (enfileirarSnapshot(sessionId)) return;
  await emitirSnapshotAgora(sessionId);
}

// Reconstrói e emite a sessão. Invalida de novo: entre o enfileiramento e a
// descarga, uma leitura REST pode ter repovoado o cache com estado antigo.
export async function emitirSnapshotAgora(sessionId: number) {
  const inicio = performance.now();
  await sessionService.invalidateCache(sessionId);
  const session = await sessionService.loadSession(sessionId);
  const payload = semCatalogoEstatico(session);
  const ms = Math.round(performance.now() - inicio);
  // Tamanho aproximado do que vai pela rede (o socket.io serializa de novo).
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  paraSala(sessionId, "session:updated", payload);

  const metricas = { sessionId, ms, bytes };
  if (ms > BROADCAST_LENTO_MS || bytes > BROADCAST_GRANDE_BYTES) {
    socketLogger.warn(metricas, "broadcast da sessão lento ou grande");
  } else {
    socketLogger.debug(metricas, "broadcast da sessão");
  }
}

export function emitPlayerUpdated(sessionId: number, data: PlayerUpdateData) {
  paraSala(sessionId, "player:updated", data);
}

export function emitTurnoTimeout(sessionId: number, data: { jogadorAnteriorId: number | null }) {
  paraSala(sessionId, "turno:timeout", { sessionId, ...data });
}

export function emitVoteRequest(sessionId: number, data: { ownerId: number; ownerNome: string; requiredUserIds: number[]; playerNames?: Record<number, string> }) {
  paraSala(sessionId, "game:vote_request", { sessionId, ...data });
}

export function emitVoteUpdate(sessionId: number, data: { votes: Record<number, "yes" | "no">; requiredUserIds: number[] }) {
  paraSala(sessionId, "game:vote_update", { sessionId, ...data });
}

export function emitVoteCancelled(sessionId: number, cancellerNome?: string) {
  paraSala(sessionId, "game:vote_cancelled", { sessionId, cancellerNome });
}

export function emitKickVoteRequest(sessionId: number, data: {
  targetPlayerId: number; targetNome: string;
  initiatorNome: string; requiredUserIds: number[];
  playerNames: Record<number, string>;
  votes: Record<number, "yes" | "no">;
  expiresAt: string;
}) {
  paraSala(sessionId, "game:kick_vote_request", { sessionId, ...data });
}

export function emitKickVoteUpdate(sessionId: number, data: {
  votes: Record<number, "yes" | "no">; requiredUserIds: number[];
}) {
  paraSala(sessionId, "game:kick_vote_update", { sessionId, ...data });
}

export function emitKickVoteResult(sessionId: number, data: {
  passed: boolean; targetNome: string; targetPlayerId: number;
}) {
  paraSala(sessionId, "game:kick_vote_result", { sessionId, ...data });
}
