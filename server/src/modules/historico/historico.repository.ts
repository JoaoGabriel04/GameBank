import { prisma } from "../../lib/prisma.js";

export class HistoricoRepository {
  // Mais recentes primeiro; `antesDeId` pagina para trás (cursor por id).
  async findBySessionId(sessionId: number, limit: number, antesDeId?: number) {
    return prisma.historico.findMany({
      where: { sessionId, ...(antesDeId ? { id: { lt: antesDeId } } : {}) },
      orderBy: { id: "desc" },
      take: limit,
    });
  }
}
