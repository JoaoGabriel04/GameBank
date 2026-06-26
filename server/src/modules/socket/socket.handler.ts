import { getIO } from "../../lib/socket.js";
import { SessionService } from "../session/session.service.js";

const sessionService = new SessionService();

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

export function emitSessionUpdated(sessionId: number, data: unknown) {
  getIO().of("/game").to(`session:${sessionId}`).emit("session:updated", data);
}

export function emitSessionClosed(sessionId: number, ranking?: unknown) {
  getIO().of("/game").to(`session:${sessionId}`).emit("session:closed", { sessionId, ranking });
}

export function emitChatMessage(sessionId: number, data: { id: number; playerId: number; playerNome: string; texto: string; createdAt: string }) {
  getIO().of("/game").to(`session:${sessionId}`).emit("chat:message", data);
}

export function emitNotificationNew(sessionId: number, data: unknown) {
  getIO().of("/game").to(`session:${sessionId}`).emit("notification:new", data);
}

export async function emitUpdatedSession(sessionId: number) {
  await sessionService.invalidateCache(sessionId);
  const session = await sessionService.loadSession(sessionId);
  emitSessionUpdated(sessionId, session);
}

export function emitPlayerUpdated(sessionId: number, data: PlayerUpdateData) {
  getIO().of("/game").to(`session:${sessionId}`).emit("player:updated", data);
}

export function emitVoteRequest(sessionId: number, data: { ownerId: number; ownerNome: string; requiredUserIds: number[]; playerNames?: Record<number, string> }) {
  getIO().of("/game").to(`session:${sessionId}`).emit("game:vote_request", { sessionId, ...data });
}

export function emitVoteUpdate(sessionId: number, data: { votes: Record<number, "yes" | "no">; requiredUserIds: number[] }) {
  getIO().of("/game").to(`session:${sessionId}`).emit("game:vote_update", { sessionId, ...data });
}

export function emitVoteCancelled(sessionId: number, cancellerNome?: string) {
  getIO().of("/game").to(`session:${sessionId}`).emit("game:vote_cancelled", { sessionId, cancellerNome });
}
