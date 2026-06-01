import { prisma } from "./prisma.js";

const CLEANUP_INTERVAL_MS = 10_000; // verifica a cada 10s

async function expireNegotiations() {
  try {
    const expired = await prisma.negotiation.findMany({
      where: { status: "pendente", expiresAt: { lt: new Date() } },
      include: { items: true, fromPlayer: true, toPlayer: true },
    });

    if (expired.length === 0) return;

    for (const negotiation of expired) {
      await prisma.$transaction(async (tx) => {
        for (const item of negotiation.items) {
          if (item.fromSide && item.sessionPossesId) {
            await tx.sessionPosses.update({
              where: { id: item.sessionPossesId },
              data: { negociando: false },
            });
          }
        }
        await tx.negotiation.update({
          where: { id: negotiation.id },
          data: { status: "expirada", respondedAt: new Date() },
        });
      });

      // Usa emitToUser (activeSockets Map) — mais confiável que emitToPlayer
      // pois não depende de socket.data.playerId estar populado
      try {
        const { emitToUser } = await import("./socket.js");
        const fromUserId = negotiation.fromPlayer?.userId;
        const toUserId   = negotiation.toPlayer?.userId;
        const payload = { negotiationId: negotiation.id };
        if (fromUserId) emitToUser(fromUserId, "negotiation:expired", payload);
        if (toUserId)   emitToUser(toUserId,   "negotiation:expired", payload);
      } catch {
        console.error("[Negociação] Erro ao emitir negotiation:expired:", negotiation.id);
      }

      // Sincroniza estado da sessão com todos os clientes
      // Garante que propriedades desbloqueadas apareçam mesmo se emit acima falhou
      try {
        const { SessionService } = await import("../modules/session/session.service.js");
        const sessionService = new SessionService();
        await sessionService.invalidateCache(negotiation.sessionId);
        const session = await sessionService.loadSession(negotiation.sessionId);
        const { emitSessionUpdated } = await import("../modules/socket/socket.handler.js");
        emitSessionUpdated(negotiation.sessionId, session);
      } catch (err) {
        console.error("[Negociação] Erro ao sincronizar sessão após expiração:", err);
      }
    }

    console.log(`[Negociação] ${expired.length} negociação(ões) expirada(s).`);
  } catch (err) {
    console.error("[Negociação] Erro no cleanup de expiradas:", err);
  }
}

export function startNegotiationCleanup() {
  setInterval(expireNegotiations, CLEANUP_INTERVAL_MS);
  expireNegotiations();
  console.log("[Negociação] Cleanup de expiradas ativo (intervalo: 10s)");
}
