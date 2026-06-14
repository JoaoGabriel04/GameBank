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
            user: {
              select: {
                  avatarUrl: true, avatarUpdatedAt: true, banner: true, frame: true, frameType: true, frameAnimated: true,
                  id: true, level: true, trophies: true,
                  user_items: true,
              },
            },
          },
        },
        times: true,
        sessionPosses: {
          include: {
            propriedade: true,
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
            user: {
              select: {
                  avatarUrl: true, avatarUpdatedAt: true, banner: true, frame: true, frameType: true, frameAnimated: true,
                  id: true, level: true, trophies: true,
                  user_items: true,
              },
            },
          },
        },
        times: true,
        sessionPosses: {
          include: {
            propriedade: true,
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
        startedAt: true,
        rewardGranted: true,
        ownerId: true,
        jogadores: {
          include: {
            team: true,
            user: {
              select: {
                  avatarUrl: true, avatarUpdatedAt: true, banner: true, frame: true, frameType: true, frameAnimated: true,
                  id: true, level: true, trophies: true,
                  user_items: true,
              },
            },
          },
        },
        times: true,
        sessionPosses: {
          include: {
            propriedade: true,
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
      // Registra o início real da partida quando entra em "Em Andamento"
      data: { status, ...(status === "Em Andamento" ? { startedAt: new Date() } : {}) },
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
    return prisma.propriedade.findMany();
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

  async findUserProfile(userId: number) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nome: true, profileComplete: true },
    });
  }

  async findUsedColors(sessionId: number) {
    const players = await prisma.sessionPlayer.findMany({
      where: { sessionId, desistiu: false },
      select: { cor: true },
    });
    return players.map((p) => p.cor);
  }

  async findTeamInSession(teamId: number, sessionId: number) {
    return prisma.sessionTeam.findFirst({ where: { id: teamId, sessionId } });
  }

  async updatePlayerBalance(playerId: number, saldo: number) {
    return prisma.sessionPlayer.update({
      where: { id: playerId },
      data: { saldo },
    });
  }

  async findTeamsBySession(sessionId: number) {
    return prisma.sessionTeam.findMany({ where: { sessionId } });
  }

  async updateTeamBalance(teamId: number, saldo: number) {
    return prisma.sessionTeam.update({ where: { id: teamId }, data: { saldo } });
  }

  async findOrphanedSessions(before: Date) {
    return prisma.session.findMany({
      where: {
        status: "Em Andamento",
        dataInicio: { lt: before },
        jogadores: { none: {} },
      },
      select: { id: true },
    });
  }
}
