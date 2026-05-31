import { prisma } from "../../lib/prisma.js";

export class HistoricoRepository {
  async findBySessionId(sessionId: number, limit = 200) {
    return prisma.historico.findMany({
      where: { sessionId },
      orderBy: { id: "desc" },
      take: limit,
    });
  }
}
