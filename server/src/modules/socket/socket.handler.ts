import { getIO } from "../../lib/socket.js";

export function emitSessionUpdated(sessionId: number, data: unknown) {
  getIO().of("/game").to(`session:${sessionId}`).emit("session:updated", data);
}

export function emitPlayerBalance(sessionId: number, userId: number, saldo: number) {
  getIO().of("/game").to(`session:${sessionId}`).emit("player:balance", { userId, saldo });
}

export function emitPropertyChanged(sessionId: number, data: unknown) {
  getIO().of("/game").to(`session:${sessionId}`).emit("property:changed", data);
}

export function emitHistoryNew(sessionId: number, data: unknown) {
  getIO().of("/game").to(`session:${sessionId}`).emit("history:new", data);
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
