import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../../generated/prisma/index.js";

export class SessionRepository {
  async findAll() {
    const sessions = await prisma.session.findMany({
      where: { status: "Esperando" },
      select: {
        id: true,
        nome: true,
        senha: true,
        modo: true,
        status: true,
        maxJogadores: true,
        saldoInicial: true,
        dataInicio: true,
        ownerId: true,
        jogadores: {
          include: {
            team: true,
            user: { select: { avatarUrl: true, avatarUpdatedAt: true, banner: true } },
          },
        },
        times: true,
        sessionPosses: {
          include: {
            posses: {
              include: { propriedade: true },
            },
            player: true,
          },
        },
        historico: true,
      },
      orderBy: { id: "asc" },
    });

    return sessions.map(({ senha, ...rest }) => ({
      ...rest,
      protegida: senha !== null,
    }));
  }

  async findById(id: number) {
    return prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        modo: true,
        status: true,
        maxJogadores: true,
        saldoInicial: true,
        dataInicio: true,
        ownerId: true,
        jogadores: {
          include: {
            team: true,
            user: { select: { avatarUrl: true, avatarUpdatedAt: true, banner: true } },
          },
        },
        times: true,
        sessionPosses: {
          include: {
            posses: {
              include: { propriedade: true },
            },
            player: true,
          },
        },
        historico: true,
      },
    });
  }

  async findByIdSimple(id: number) {
    return prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        modo: true,
        status: true,
        maxJogadores: true,
        saldoInicial: true,
        dataInicio: true,
        ownerId: true,
        jogadores: {
          include: {
            team: true,
            user: { select: { avatarUrl: true, avatarUpdatedAt: true, banner: true } },
          },
        },
        times: true,
        sessionPosses: {
          include: {
            posses: {
              include: { propriedade: true },
            },
            player: true,
          },
        },
        historico: true,
        debts: {
          where: { pago: false },
          include: { player: { select: { id: true, nome: true } } },
        },
      },
    });
  }

  async findBySenhaWithStatus(sessionId: number) {
    return prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        senha: true,
        nome: true,
        status: true,
        maxJogadores: true,
        modo: true,
        _count: { select: { jogadores: true } },
      },
    });
  }

  async create(data: Prisma.SessionCreateInput) {
    return prisma.session.create({ data });
  }

  async setSenha(id: number, senhaHash: string) {
    return prisma.session.update({
      where: { id },
      data: { senha: senhaHash },
    });
  }

  async findBySenha(sessionId: number) {
    return prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, senha: true, nome: true },
    });
  }

  async updateStatus(id: number, status: string) {
    return prisma.session.update({
      where: { id },
      data: { status },
    });
  }

  async countPlayers(sessionId: number) {
    const result = await prisma.sessionPlayer.count({
      where: { sessionId },
    });
    return result;
  }

  async delete(id: number) {
    return prisma.session.delete({ where: { id } });
  }

  async findPlayerByUserAndSession(userId: number, sessionId: number) {
    return prisma.sessionPlayer.findFirst({
      where: { userId, sessionId },
    });
  }

  async findPlayerByUserInWaiting(userId: number, excludeSessionId?: number) {
    return prisma.sessionPlayer.findFirst({
      where: {
        userId,
        session: {
          status: "Esperando",
          ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
        },
      },
      include: { session: { select: { id: true, nome: true } } },
    });
  }

  async countActivePlayers(sessionId: number): Promise<number> {
    return prisma.sessionPlayer.count({
      where: { sessionId, desistiu: false },
    });
  }

  async deletePlayer(id: number) {
    return prisma.sessionPlayer.delete({ where: { id } });
  }

  async createPlayer(data: Prisma.SessionPlayerCreateInput) {
    return prisma.sessionPlayer.create({ data });
  }

  async createTeam(data: Prisma.SessionTeamCreateInput) {
    return prisma.sessionTeam.create({ data });
  }

  async createManySessionPosses(data: Prisma.SessionPossesCreateManyInput[]) {
    return prisma.sessionPosses.createMany({ data });
  }

  async deletePlayersBySession(sessionId: number) {
    return prisma.sessionPlayer.deleteMany({ where: { sessionId } });
  }

  async deleteTeamsBySession(sessionId: number) {
    return prisma.sessionTeam.deleteMany({ where: { sessionId } });
  }

  async deleteSessionPossesBySession(sessionId: number) {
    return prisma.sessionPosses.deleteMany({ where: { sessionId } });
  }

  async deleteHistoricoBySession(sessionId: number) {
    return prisma.historico.deleteMany({ where: { sessionId } });
  }

  async findAllPosses() {
    return prisma.posses.findMany();
  }

  async findByPlayerUserId(userId: number) {
    return prisma.session.findFirst({
      where: {
        jogadores: { some: { userId } },
        status: { in: ["Esperando", "Em Andamento"] },
      },
      select: {
        id: true,
        nome: true,
        modo: true,
        status: true,
      },
    });
  }

  async updatePlayerUserId(playerId: number, userId: number) {
    return prisma.sessionPlayer.updateMany({
      where: { id: playerId },
      data: { userId },
    });
  }
}
