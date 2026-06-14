import { prisma } from "../../lib/prisma.js";

export class BancoRepository {
  async findPlayerById(id: number) {
    return prisma.sessionPlayer.findUnique({ where: { id } });
  }

  async updatePlayerBalance(id: number, decrement?: number, increment?: number) {
    const data: any = {};
    if (decrement !== undefined) data.saldo = { decrement };
    if (increment !== undefined) data.saldo = { increment };
    return prisma.sessionPlayer.update({ where: { id }, data });
  }

  async findPlayersBySession(sessionId: number, excludeId?: number) {
    const where: any = { sessionId };
    if (excludeId !== undefined) where.id = { not: excludeId };
    return prisma.sessionPlayer.findMany({ where });
  }

  async findSessionPossesById(id: number) {
    return prisma.sessionPosses.findUnique({
      where: { id },
      include: {
        propriedade: true,
        player: true,
      },
    });
  }

  async createHistorico(data: { sessionId: number; data: Date; tipo: string; detalhes: string }) {
    return prisma.historico.create({ data });
  }
}
