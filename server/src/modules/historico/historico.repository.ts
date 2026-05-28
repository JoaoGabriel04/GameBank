import { prisma } from "../../lib/prisma.js";

export class HistoricoRepository {
  async findBySessionId(sessionId: number) {
    return prisma.historico.findMany({
      where: { sessionId },
    });
  }
}
