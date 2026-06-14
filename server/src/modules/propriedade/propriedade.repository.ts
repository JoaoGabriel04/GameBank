import { prisma } from "../../lib/prisma.js";
import type { NotificationStatus } from "../../../generated/prisma/index.js";

export class PropriedadeRepository {
  async findPropriedadeById(id: number) {
    return prisma.propriedade.findUnique({ where: { id } });
  }

  async findPlayerById(id: number) {
    return prisma.sessionPlayer.findUnique({ where: { id } });
  }

  async findSessionPosses(sessionId: number, propId: number) {
    return prisma.sessionPosses.findFirst({
      where: { sessionId, propId },
      include: {
        propriedade: true,
        player: true,
        lastOwner: true,
      },
    });
  }

  async findSessionPossesById(id: number) {
    return prisma.sessionPosses.findUnique({
      where: { id },
      include: {
        propriedade: true,
        player: true,
        lastOwner: true,
      },
    });
  }

  async updateSessionPossesByProps(sessionId: number, propId: number, data: { playerId: number | null; casas?: number; hipotecada?: boolean }) {
    return prisma.sessionPosses.updateMany({
      where: { sessionId, propId },
      data,
    });
  }

  async updateSessionPosses(id: number, data: { playerId?: number | null; casas?: number; hipotecada?: boolean }) {
    return prisma.sessionPosses.update({ where: { id }, data });
  }

  async updatePlayerBalance(id: number, decrement?: number, increment?: number) {
    const data: any = {};
    if (decrement !== undefined) data.saldo = { decrement };
    if (increment !== undefined) data.saldo = { increment };
    return prisma.sessionPlayer.update({ where: { id }, data });
  }

  async findFirstHipotecada() {
    return prisma.sessionPosses.findFirst({ where: { hipotecada: true } });
  }

  async createHistorico(data: { sessionId: number; data: Date; tipo: string; detalhes: string }) {
    return prisma.historico.create({ data });
  }

  async findNotificationById(id: number) {
    return prisma.notification.findUnique({
      where: { id },
      include: {
        fromPlayer: true,
        toPlayer: true,
      },
    });
  }

  async createNotification(data: {
    sessionId: number;
    tipo: string;
    fromPlayerId: number;
    toPlayerId: number;
    sessionPossesId: number;
  }) {
    return prisma.notification.create({ data });
  }

  async updateNotification(id: number, data: { status: string; respondedAt: Date }) {
    return prisma.notification.update({
      where: { id },
      data: { ...data, status: data.status as NotificationStatus },
    });
  }
}
