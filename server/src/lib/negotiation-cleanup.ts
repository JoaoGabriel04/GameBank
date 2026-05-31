import { prisma } from "./prisma.js";

const CLEANUP_INTERVAL_MS = 30_000; // verifica a cada 30s

async function expireNegotiations() {
  try {
    const expired = await prisma.negotiation.findMany({
      where: { status: "pendente", expiresAt: { lt: new Date() } },
      include: { items: true },
    });

    if (expired.length === 0) return;

    for (const negotiation of expired) {
      await prisma.$transaction(async (tx) => {
        // Destrava as propriedades que estavam bloqueadas (fromSide = o que o proponente ofereceu)
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

      // Notifica os jogadores via socket (lazy import para evitar ciclo)
      try {
        const { emitToPlayer } = await import("./socket.js");
        emitToPlayer(negotiation.sessionId, negotiation.fromPlayerId, "negotiation:expired", {
          negotiationId: negotiation.id,
        });
        emitToPlayer(negotiation.sessionId, negotiation.toPlayerId, "negotiation:expired", {
          negotiationId: negotiation.id,
        });
      } catch {
        // Socket pode não estar disponível — não é crítico
      }
    }

    console.log(`[Negociação] ${expired.length} negociação(ões) expirada(s).`);
  } catch (err) {
    console.error("[Negociação] Erro no cleanup de expiradas:", err);
  }
}

export function startNegotiationCleanup() {
  setInterval(expireNegotiations, CLEANUP_INTERVAL_MS);
  // Executa imediatamente no startup para limpar negociações antigas de reinicios anteriores
  expireNegotiations();
  console.log("[Negociação] Cleanup de expiradas ativo (intervalo: 30s)");
}
