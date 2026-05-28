import { prisma } from "../../lib/prisma.js";

export class DividaRepository {
  async create(data: { sessionId: number; playerId: number; valor: number; descricao: string }) {
    return prisma.debt.create({ data });
  }

  async findPendentesByPlayer(sessionId: number, playerId: number) {
    return prisma.debt.findMany({
      where: { sessionId, playerId, pago: false },
      orderBy: { createdAt: "asc" },
    });
  }

  async findPendentesBySession(sessionId: number) {
    return prisma.debt.findMany({
      where: { sessionId, pago: false },
      include: { player: { select: { id: true, nome: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async pagarDivida(debtId: number) {
    return prisma.debt.update({
      where: { id: debtId },
      data: { pago: true, paidAt: new Date() },
    });
  }

  async findById(debtId: number) {
    return prisma.debt.findUnique({ where: { id: debtId } });
  }
}
