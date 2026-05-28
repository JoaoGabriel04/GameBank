import { prisma } from "../../lib/prisma.js";

export class NegociacaoRepository {
  async findNegotiationById(id: number) {
    return prisma.negotiation.findUnique({
      where: { id },
      include: {
        items: true,
        fromPlayer: true,
        toPlayer: true,
      },
    });
  }

  async findPlayerById(id: number) {
    return prisma.sessionPlayer.findUnique({ where: { id } });
  }

  async findSessionPosses(sessionId: number, possesId: number) {
    return prisma.sessionPosses.findUnique({
      where: { id: possesId },
      include: {
        posses: { include: { propriedade: true } },
        player: true,
      },
    });
  }

  async findSessionPossesByPlayer(sessionId: number, playerId: number) {
    return prisma.sessionPosses.findMany({
      where: { sessionId, playerId, hipotecada: false },
      include: {
        posses: { include: { propriedade: true } },
      },
    });
  }

  async findNegotiationTimeout(id: number) {
    return prisma.negotiation.findUnique({
      where: { id },
      select: { createdAt: true, status: true },
    });
  }

  async createNegotiation(data: {
    sessionId: number;
    fromPlayerId: number;
    toPlayerId: number;
    status?: string;
  }) {
    return prisma.negotiation.create({
      data: {
        sessionId: data.sessionId,
        fromPlayerId: data.fromPlayerId,
        toPlayerId: data.toPlayerId,
        status: data.status ?? "pendente",
        items: { create: [] },
      },
      include: { items: true },
    });
  }

  async createNegotiationItems(
    negotiationId: number,
    items: { sessionPossesId?: number | null; fromSide: boolean; valor?: number | null }[]
  ) {
    return prisma.negotiationItem.createMany({
      data: items.map((item) => ({
        negotiationId,
        sessionPossesId: item.sessionPossesId ?? null,
        fromSide: item.fromSide,
        valor: item.valor ?? null,
      })),
    });
  }

  async updateNegotiationStatus(id: number, status: string) {
    return prisma.negotiation.update({
      where: { id },
      data: { status, respondedAt: new Date() },
    });
  }

  async setNegociando(sessionPossesId: number, value: boolean) {
    return prisma.sessionPosses.update({
      where: { id: sessionPossesId },
      data: { negociando: value },
    });
  }

  async createHistorico(data: {
    sessionId: number;
    data: Date;
    tipo: string;
    detalhes: string;
  }) {
    return prisma.historico.create({ data });
  }

  async updatePlayerBalance(playerId: number, delta: number) {
    return prisma.sessionPlayer.update({
      where: { id: playerId },
      data: delta >= 0
        ? { saldo: { increment: delta } }
        : { saldo: { decrement: Math.abs(delta) } },
    });
  }

  async transferProperty(sessionPossesId: number, newPlayerId: number) {
    return prisma.sessionPosses.update({
      where: { id: sessionPossesId },
      data: { playerId: newPlayerId },
    });
  }

  async findSessionPossesByPlayerFull(sessionId: number, playerId: number) {
    return prisma.sessionPosses.findMany({
      where: { sessionId, playerId },
      include: {
        posses: { include: { propriedade: true } },
      },
    });
  }

  async findPendentesByPlayer(sessionId: number, playerId: number) {
    return prisma.negotiation.findMany({
      where: {
        sessionId,
        status: "pendente",
        OR: [
          { fromPlayerId: playerId },
          { toPlayerId: playerId },
        ],
      },
      include: {
        items: true,
        fromPlayer: true,
        toPlayer: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
