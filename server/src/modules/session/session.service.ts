import bcrypt from "bcryptjs";
import { SessionRepository } from "./session.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { getRedis } from "../../lib/redis.js";
import { MissionsService } from "../missions/missions.service.js";
import { pickPlayerColor } from "../../utils/player-color.js";
import { mapSessionWithAvatars, mapSessionPlayers } from "../../utils/session-mapper.js";

const BCRYPT_ROUNDS = 10;
const CACHE_TTL_S = 60;

export class SessionService {
  constructor(private repo = new SessionRepository()) {}

  async createSession(
    nome: string | undefined,
    senha: string | undefined,
    modo: string = "individual",
    maxJogadores: number = 6,
    saldoInicial: number = 25000,
    userId?: number,
    times?: { nome: string; cor: string }[],
    criadorNome?: string,
    criadorCor?: string,
    criadorTeamIndex?: number
  ) {
    if (modo === "duplas" && (!times || times.length < 2)) {
      throw new AppError(400, "Modo duplas requer pelo menos 2 times.");
    }

    if (modo === "duplas" && maxJogadores > 12) {
      throw new AppError(400, "Modo duplas suporta no máximo 12 jogadores (6 duplas).");
    }

    if (modo === "individual" && maxJogadores > 6) {
      throw new AppError(400, "Modo individual suporta no máximo 6 jogadores.");
    }

    const novaSessao = await this.repo.create({
      nome,
      modo,
      maxJogadores,
      saldoInicial,
      ...(userId ? { ownerId: userId } : {}),
    });

    if (senha) {
      const hash = await bcrypt.hash(senha, BCRYPT_ROUNDS);
      await this.repo.setSenha(novaSessao.id, hash);
    }

    let createdTeams: { id: number }[] = [];

    if (modo === "duplas" && times) {
      createdTeams = await Promise.all(
        times.map((t) =>
          this.repo.createTeam({
            nome: t.nome,
            cor: t.cor,
            session: { connect: { id: novaSessao.id } },
          })
        )
      );
    }

    // Cria o criador como primeiro jogador (apelido e cor vêm do perfil)
    let playerId: number | undefined;
    if (userId) {
      const owner = await prisma.user.findUnique({ where: { id: userId } });
      if (!owner?.profileComplete) {
        throw new AppError(403, "Complete seu perfil antes de criar uma sala");
      }
      const teamId = modo === "duplas" && criadorTeamIndex != null
        ? createdTeams[criadorTeamIndex]?.id
        : undefined;
      const cor = pickPlayerColor(userId, []);

      const player = await this.repo.createPlayer({
        nome: owner.nome,
        cor,
        saldo: 0,
        session: { connect: { id: novaSessao.id } },
        user: { connect: { id: userId } },
        ...(teamId ? { team: { connect: { id: teamId } } } : {}),
      });
      playerId = player.id;
    } else if (criadorNome && criadorCor) {
      const teamId = modo === "duplas" && criadorTeamIndex != null
        ? createdTeams[criadorTeamIndex]?.id
        : undefined;

      const player = await this.repo.createPlayer({
        nome: criadorNome,
        cor: criadorCor,
        saldo: 0,
        session: { connect: { id: novaSessao.id } },
        ...(teamId ? { team: { connect: { id: teamId } } } : {}),
      });
      playerId = player.id;
    }

    await this.invalidateCache(novaSessao.id);

    const result = await this.repo.findById(novaSessao.id);
    return { session: result, playerId };
  }

  async joinSession(
    sessionId: number,
    senha: string | undefined,
    nome: string,
    cor: string,
    userId?: number,
    teamId?: number,
    spectator?: boolean
  ) {
    const session = await this.repo.findBySenhaWithStatus(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");

    if (session.status !== "Esperando") {
      throw new AppError(400, "Esta sessão já foi iniciada ou finalizada.");
    }

    if (session.senha) {
      if (!senha) {
        throw new AppError(401, "Esta sala requer senha");
      }
      const valida = await bcrypt.compare(senha, session.senha);
      if (!valida) {
        throw new AppError(401, "Senha incorreta");
      }
    }

    // Verifica se o usuário já está nesta sessão
    if (userId) {
      const existingPlayer = await this.repo.findPlayerByUserAndSession(userId, sessionId);
      if (existingPlayer) {
        throw new AppError(400, "Você já está nesta sala.");
      }

      // Remove o jogador de outras salas em espera
      const otherPlayer = await this.repo.findPlayerByUserInWaiting(userId, sessionId);
      if (otherPlayer) {
        await this.repo.deletePlayer(otherPlayer.id);
      }
    }

    let resolvedNome = nome?.trim() || "";
    let resolvedCor = spectator ? "zinc" : (cor || "zinc");

    if (userId) {
      const account = await prisma.user.findUnique({ where: { id: userId } });
      if (!account?.profileComplete) {
        throw new AppError(403, "Complete seu perfil antes de entrar em uma sala");
      }
      resolvedNome = account.nome;
      if (!spectator) {
        const usedColors = (
          await prisma.sessionPlayer.findMany({
            where: { sessionId, desistiu: false },
            select: { cor: true },
          })
        ).map((p) => p.cor);
        resolvedCor = pickPlayerColor(userId, usedColors);
      }
    } else if (!spectator) {
      if (!resolvedNome) throw new AppError(400, "Nome obrigatório");
      if (!cor) throw new AppError(400, "Cor obrigatória");
    }

    if (!spectator) {
      const playerCount = await this.repo.countPlayers(sessionId);
      if (playerCount >= session.maxJogadores) {
        throw new AppError(400, "Esta sala atingiu o número máximo de jogadores.");
      }

      // In duplas mode, validate team
      if (session.modo === "duplas") {
        if (!teamId) {
          throw new AppError(400, "Modo duplas requer seleção de time.");
        }
        const teamExists = await prisma.sessionTeam.findFirst({
          where: { id: teamId, sessionId },
        });
        if (!teamExists) {
          throw new AppError(400, "Time não encontrado nesta sessão.");
        }
      }
    }

    const player = await this.repo.createPlayer({
      nome: resolvedNome,
      cor: resolvedCor,
      saldo: 0,
      desistiu: spectator ?? false,
      session: { connect: { id: sessionId } },
      ...(userId ? { user: { connect: { id: userId } } } : {}),
      ...(teamId && !spectator ? { team: { connect: { id: teamId } } } : {}),
    });

    await this.invalidateCache(sessionId);

    return { sessionId, playerId: player.id };
  }

  async startSession(sessionId: number, userId?: number) {
    const session = await this.repo.findByIdSimple(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");

    if (session.status !== "Esperando") {
      throw new AppError(400, "Sessão já foi iniciada ou finalizada.");
    }

    if (session.ownerId && userId && session.ownerId !== userId) {
      throw new AppError(403, "Apenas o dono da sala pode iniciar a partida.");
    }

    const activePlayers = session.jogadores.filter((p) => !p.desistiu);
    if (activePlayers.length < 2) {
      throw new AppError(400, "São necessários pelo menos 2 jogadores ativos para iniciar.");
    }

    if (session.modo === "duplas") {
      const playersWithoutTeam = session.jogadores.filter((p) => !p.teamId);
      if (playersWithoutTeam.length > 0) {
        throw new AppError(400, "Todos os jogadores devem estar em um time para iniciar.");
      }
    }

    // Create session posses (properties)
    const possesBase = await this.repo.findAllPosses();
    const sessionPossesData = possesBase.map((p) => ({
      sessionId: session.id,
      possesId: p.id,
      playerId: null,
      casas: 0,
      hipotecada: false,
    }));
    await this.repo.createManySessionPosses(sessionPossesData);

    // Assign initial balance to players (individual) or teams (duplas)
    if (session.modo === "individual") {
      await Promise.all(
        activePlayers.map((p) =>
          prisma.sessionPlayer.update({
            where: { id: p.id },
            data: { saldo: session.saldoInicial ?? 25000 },
          })
        )
      );
    } else {
      // Assign balance to teams in duplas mode
      const teams = await prisma.sessionTeam.findMany({
        where: { sessionId: session.id },
      });
      await Promise.all(
        teams.map((t) =>
          prisma.sessionTeam.update({
            where: { id: t.id },
            data: { saldo: session.saldoInicial ?? 25000 },
          })
        )
      );
    }

    await this.repo.updateStatus(session.id, "Em Andamento");

    await this.invalidateCache(session.id);
    return this.repo.findById(session.id);
  }

  async invalidateCache(sessionId: number) {
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.del(`session:cache:${sessionId}`);
    } catch {
      // Non-critical
    }
  }

  async listSessions() {
    // Auto-limpeza de salas órfãs "Em Andamento" sem jogadores
    await this.cleanupOrphanedSessions();
    return this.repo.findAll().then((sessions) => sessions.map(mapSessionWithAvatars));
  }

  private async cleanupOrphanedSessions() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const orphaned = await prisma.session.findMany({
        where: {
          status: "Em Andamento",
          dataInicio: { lt: oneDayAgo },
          jogadores: { none: {} },
        },
        select: { id: true },
      });

      for (const session of orphaned) {
        await this.endSession(session.id);
      }

      if (orphaned.length > 0) {
        console.log(`[Cleanup] ${orphaned.length} sessões órfãs removidas.`);
      }
    } catch {
      // Non-critical
    }
  }

  async loadSession(sessionId: number) {
    const redis = getRedis();
    const cacheKey = `session:cache:${sessionId}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {
        // Cache unavailable — fallback to DB
      }
    }

    const session = await this.repo.findByIdSimple(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");

    const enriched = mapSessionWithAvatars(session);

    if (redis) {
      try {
        await redis.setEx(cacheKey, CACHE_TTL_S, JSON.stringify(enriched));
      } catch {
        // Non-critical
      }
    }

    return enriched;
  }

  async findMyActiveSession(userId: number) {
    const session = await this.repo.findByPlayerUserId(userId);
    return session;
  }

  async backfillPlayerUserId(playerId: number, userId: number) {
    return this.repo.updatePlayerUserId(playerId, userId);
  }

  async quitSession(sessionId: number, userId: number) {
    const player = await this.repo.findPlayerByUserAndSession(userId, sessionId);
    if (!player) {
      throw new AppError(404, "Você não está nesta sala.");
    }

    const session = await this.repo.findByIdSimple(sessionId);
    if (!session) {
      throw new AppError(404, "Sessão não encontrada");
    }

    if (session.status === "Em Andamento" && !player.desistiu) {
      await prisma.$transaction(async (tx) => {
        await tx.sessionPosses.updateMany({
          where: { sessionId, playerId: player.id },
          data: {
            playerId: null,
            casas: 0,
            hipotecada: false,
          },
        });

        await tx.sessionPlayer.update({
          where: { id: player.id },
          data: { saldo: 0 },
        });

        await tx.message.deleteMany({
          where: { sessionId, playerId: player.id },
        });

        await tx.notification.deleteMany({
          where: {
            sessionId,
            OR: [{ fromPlayerId: player.id }, { toPlayerId: player.id }],
          },
        });

        await tx.negotiationItem.deleteMany({
          where: {
            negotiation: {
              sessionId,
              OR: [{ fromPlayerId: player.id }, { toPlayerId: player.id }],
            },
          },
        });

        await tx.negotiation.deleteMany({
          where: {
            sessionId,
            OR: [{ fromPlayerId: player.id }, { toPlayerId: player.id }],
          },
        });

        await tx.debt.deleteMany({
          where: { sessionId, playerId: player.id },
        });

        await tx.sessionPlayer.delete({
          where: { id: player.id },
        });
      });
    } else {
      await this.repo.deletePlayer(player.id);
    }

    await this.invalidateCache(sessionId);

    // Se não restarem jogadores ativos na sala, auto-encerra
    const activeCount = await this.repo.countActivePlayers(sessionId);
    if (activeCount === 0) {
      await this.endSession(sessionId);
    }
  }

  async desistirSession(sessionId: number, userId: number) {
    const player = await this.repo.findPlayerByUserAndSession(userId, sessionId);
    if (!player) {
      throw new AppError(404, "Você não está nesta sala.");
    }

    if (player.desistiu) {
      throw new AppError(400, "Você já desistiu desta partida.");
    }

    const session = await this.repo.findByIdSimple(sessionId);
    if (!session || session.status !== "Em Andamento") {
      throw new AppError(400, "Só é possível desistir de uma partida em andamento.");
    }

    // Calcular patrimônio antes de zerar
    let patrimony = player.saldo;
    for (const sp of session.sessionPosses ?? []) {
      if (sp.playerId === player.id && sp.posses?.propriedade) {
        patrimony += sp.posses.propriedade.custo_compra;
        patrimony += sp.casas * sp.posses.propriedade.custo_casa;
      }
    }

    if (patrimony >= 30000) {
      throw new AppError(400, `Você não pode desistir com patrimônio de R$ ${patrimony.toLocaleString("pt-BR")} (limite: R$ 29.999).`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.sessionPlayer.update({
        where: { id: player.id },
        data: { patrimonyAtDesistir: patrimony },
      });

      await tx.sessionPosses.updateMany({
        where: { sessionId, playerId: player.id },
        data: {
          playerId: null,
          casas: 0,
          hipotecada: false,
          negociando: false,
        },
      });

      await tx.sessionPlayer.update({
        where: { id: player.id },
        data: { saldo: 0, desistiu: true },
      });
    });

    await this.invalidateCache(sessionId);
  }

  async getPlayerByUser(sessionId: number, userId: number) {
    return this.repo.findPlayerByUserAndSession(userId, sessionId);
  }

  private missionService = new MissionsService();

  async endSession(sessionId: number, userId?: number) {
    if (userId) {
      const session = await this.repo.findByIdSimple(sessionId);
      if (session?.ownerId && session.ownerId !== userId) {
        throw new AppError(403, "Apenas o dono da sala pode encerrá-la.");
      }
    }

    await this.invalidateCache(sessionId);

    const session = await this.repo.findByIdSimple(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");

    const ranked = this.calculateRankings(session);

    await prisma.$transaction(async (tx) => {
      for (const entry of ranked) {
        const p = entry.player;
        if (!p.userId) continue;

        await tx.gameResult.create({
          data: {
            sessionId,
            userId: p.userId,
            position: entry.position,
            patrimony: entry.patrimony,
            xpEarned: entry.xpEarned,
            coinsEarned: entry.coinsEarned,
          },
        });

        const user = await tx.user.findUnique({ where: { id: p.userId } });
        if (!user) continue;

        const newXp = user.xp + entry.xpEarned;
        const newLevel = this.getLevelFromXp(newXp);

        await tx.user.update({
          where: { id: p.userId },
          data: {
            xp: { increment: entry.xpEarned },
            coins: { increment: entry.coinsEarned },
            totalGames: { increment: 1 },
            ...(entry.position === 1 ? { totalWins: { increment: 1 } } : {}),
            ...(entry.position <= 3 ? { totalTop3: { increment: 1 } } : {}),
            ...(newLevel > user.level ? { level: newLevel } : {}),
          },
        });
      }

      await tx.negotiationItem.deleteMany({ where: { negotiation: { sessionId } } });
      await tx.negotiation.deleteMany({ where: { sessionId } });
      await tx.notification.deleteMany({ where: { sessionId } });
      await tx.message.deleteMany({ where: { sessionId } });
      await tx.debt.deleteMany({ where: { sessionId } });
      await tx.sessionPlayer.deleteMany({ where: { sessionId } });
      await tx.sessionTeam.deleteMany({ where: { sessionId } });
      await tx.sessionPosses.deleteMany({ where: { sessionId } });
      await tx.historico.deleteMany({ where: { sessionId } });
      await tx.session.delete({ where: { id: sessionId } });
    });

    // Track cumulative missions (non-critical, after transaction)
    for (const entry of ranked) {
      const p = entry.player;
      if (!p.userId) continue;
      try {
        await this.missionService.track(p.userId, "games_played", 1);
        if (entry.position === 1) await this.missionService.track(p.userId, "wins", 1);
        if (entry.position <= 3) await this.missionService.track(p.userId, "top3", 1);
      } catch (e) {
        console.error("Erro ao atualizar missoes:", e);
      }
    }

    return ranked;
  }

  private calculateRankings(session: any) {
    const players = mapSessionPlayers(session.jogadores ?? []);
    const posses = session.sessionPosses ?? [];

    const withPatrimony = players.map((p: any) => {
      let patrimony = p.saldo;
      if (p.desistiu && p.patrimonyAtDesistir != null) {
        patrimony = p.patrimonyAtDesistir;
      } else {
        for (const sp of posses) {
          if (sp.playerId === p.id && sp.posses?.propriedade) {
            patrimony += sp.posses.propriedade.custo_compra;
            patrimony += sp.casas * sp.posses.propriedade.custo_casa;
          }
        }
      }
      return { player: p, patrimony };
    });

    withPatrimony.sort((a: any, b: any) => b.patrimony - a.patrimony);

    return withPatrimony.map((entry: any, index: number) => {
      const position = index + 1;
      const total = withPatrimony.length;
      let xpEarned = 0;
      let coinsEarned = 0;

      xpEarned = 50 + (total - position) * 10;
      if (position === 1) coinsEarned = 100;
      else if (position === 2) coinsEarned = 50;
      else if (position === 3) coinsEarned = 25;

      return { ...entry, position, xpEarned, coinsEarned };
    });
  }

  private getLevelFromXp(totalXp: number): number {
    let level = 1;
    while (true) {
      const xpNeeded = Math.floor(200 * Math.pow(1.04, level - 1));
      if (totalXp < xpNeeded) return level;
      totalXp -= xpNeeded;
      level++;
    }
  }
}
