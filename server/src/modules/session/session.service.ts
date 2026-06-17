import bcrypt from "bcryptjs";
import { SessionRepository } from "./session.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js"; // usado apenas em $transaction
import { getRedis } from "../../lib/redis.js";
import { sessionLogger } from "../../lib/logger.js";
import { MissionsService } from "../missions/missions.service.js";
import type { SessionModo } from "../../../generated/prisma/index.js";
import { RankingService } from "../ranking/ranking.service.js";
import { BauService } from "../bau/bau.service.js";
import { pickPlayerColor } from "../../utils/player-color.js";
import { mapSessionWithAvatars, mapSessionPlayers } from "../../utils/session-mapper.js";
import { addXp } from "../../utils/level.js";
import { clearSessionDeck } from "../carta/carta.repository.js";
import { getMinPlayersToStart } from "../../shared/constants/session.js";
import { calcularRecompensa, type RewardResult } from "./reward.service.js";
import { calcularDeltaTrofeus } from "../../shared/constants/trophies.js";
import { recompensasQueue, missoesQueue } from "../../lib/queues.js";
import type { RecompensasBauJob } from "../../workers/recompensas.worker.js";
import type { MissoesJob } from "../../workers/missoes.worker.js";

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

    if (maxJogadores < 3) {
      throw new AppError(400, "Mínimo de 3 jogadores.");
    }

    if (maxJogadores > 6) {
      throw new AppError(400, "Máximo de 6 jogadores.");
    }

    const novaSessao = await this.repo.create({
      nome,
      modo: modo as SessionModo,
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
      const owner = await this.repo.findUserProfile(userId);
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
      const account = await this.repo.findUserProfile(userId);
      if (!account?.profileComplete) {
        throw new AppError(403, "Complete seu perfil antes de entrar em uma sala");
      }
      resolvedNome = account.nome;
      if (!spectator) {
        const usedColors = await this.repo.findUsedColors(sessionId);
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
        const teamExists = await this.repo.findTeamInSession(teamId, sessionId);
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
    const minPlayers = getMinPlayersToStart();
    if (activePlayers.length < minPlayers) {
      throw new AppError(400, `São necessários pelo menos ${minPlayers} jogadores ativos para iniciar.`);
    }

    if (session.modo === "duplas") {
      const playersWithoutTeam = activePlayers.filter((p) => !p.teamId);
      if (playersWithoutTeam.length > 0) {
        throw new AppError(400, "Todos os jogadores devem estar em um time para iniciar.");
      }
      const teamsWithPlayers = new Set(activePlayers.map((p) => p.teamId).filter(Boolean));
      if (teamsWithPlayers.size < 2) {
        throw new AppError(400, "São necessários pelo menos 2 times com jogadores para iniciar.");
      }
    }

    // Create session posses (properties)
    const possesBase = await this.repo.findAllPosses();
    const sessionPossesData = possesBase.map((p) => ({
      sessionId: session.id,
      propId: p.id,
      playerId: null,
      casas: 0,
      hipotecada: false,
    }));
    await this.repo.createManySessionPosses(sessionPossesData);

    // Assign initial balance to players (individual) or teams (duplas)
    if (session.modo === "individual") {
      await Promise.all(
        activePlayers.map((p) =>
          this.repo.updatePlayerBalance(p.id, session.saldoInicial ?? 25000)
        )
      );
    } else {
      const teams = await this.repo.findTeamsBySession(session.id);
      await Promise.all(
        teams.map((t) => this.repo.updateTeamBalance(t.id, session.saldoInicial ?? 25000))
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
    return this.repo.findAll().then(async (sessions) => {
      const mapped = await Promise.all(sessions.map(mapSessionWithAvatars));
      return mapped;
    });
  }

  private async cleanupOrphanedSessions() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const orphaned = await this.repo.findOrphanedSessions(oneDayAgo);

      for (const session of orphaned) {
        await this.endSession(session.id);
      }

      if (orphaned.length > 0) {
        sessionLogger.info({ count: orphaned.length }, "sessões órfãs removidas");
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

    const enriched = await mapSessionWithAvatars(session);

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

    // Auto-end: se sobrar 0 ou 1 jogador ativo, finaliza a partida
    const activeCount = await this.repo.countActivePlayers(sessionId);
    if (activeCount <= 1) {
      const ranking = await this.endSession(sessionId);
      return { autoEnded: true as const, ranking };
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
      if (sp.playerId === player.id && sp.propriedade) {
        patrimony += sp.propriedade.custo_compra;
        patrimony += sp.casas * sp.propriedade.custo_casa;
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
        data: { saldo: 0, desistiu: true, motivoDesistencia: "VOLUNTARIA", desistiuEm: new Date() },
      });
    });

    await this.invalidateCache(sessionId);

    // Auto-end: se sobrar 0 ou 1 jogador ativo, finaliza a partida
    const activeCount = await this.repo.countActivePlayers(sessionId);
    if (activeCount <= 1) {
      const ranking = await this.endSession(sessionId);
      return { autoEnded: true as const, ranking };
    }
  }

  async getPlayerByUser(sessionId: number, userId: number) {
    return this.repo.findPlayerByUserAndSession(userId, sessionId);
  }

  private missionService = new MissionsService();
  private rankingService = new RankingService();
  private bauService = new BauService();

  async endSession(sessionId: number, userId?: number, isAdmin = false) {
    if (userId && !isAdmin) {
      const session = await this.repo.findByIdSimple(sessionId);
      if (session?.ownerId && session.ownerId !== userId) {
        throw new AppError(403, "Apenas o dono da sala pode encerrá-la.");
      }
    }

    await this.invalidateCache(sessionId);
    clearSessionDeck(sessionId);

    const session = await this.repo.findByIdSimple(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");

    // Sala de espera encerrada pelo dono: apenas deleta, sem recompensar ninguém
    if (session.status === "Esperando") {
      await prisma.$transaction(async (tx) => {
        await tx.message.deleteMany({ where: { sessionId } });
        await tx.sessionPlayer.deleteMany({ where: { sessionId } });
        await tx.sessionTeam.deleteMany({ where: { sessionId } });
        await tx.session.delete({ where: { id: sessionId } });
      });
      return [];
    }

    // Proteção contra duplo crédito de recompensa
    if (session.rewardGranted) {
      throw new AppError(400, "Recompensas já foram distribuídas para esta partida.");
    }

    const ranked = await this.calculateRankings(session);

    // Início real da partida — fallback para dataInicio em sessões antigas sem startedAt
    const sessionStartedAt: Date = session.startedAt ?? session.dataInicio;

    // Calcula as recompensas ANTES da transação: o cálculo lê posses, negociações
    // e dívidas que serão deletadas junto com a sessão na finalização.
    const rewardByPlayer = new Map<number, RewardResult>();
    for (const entry of ranked) {
      const p = entry.player;
      if (!p.userId) continue;
      const reward = await calcularRecompensa({
        userId: p.userId,
        playerId: p.id,
        sessionId,
        position: entry.position,
        patrimony: entry.patrimony,
        sessionStartedAt,
      });
      rewardByPlayer.set(p.id, reward);
    }

    const trophyByPlayer = new Map<number, { trophyDelta: number; trophyBefore: number; trophyAfter: number }>();

    await prisma.$transaction(async (tx) => {
      // Marca rewardGranted antes de creditar (lock contra race condition)
      await tx.session.update({ where: { id: sessionId }, data: { rewardGranted: true } });

      for (const entry of ranked) {
        const p = entry.player;
        if (!p.userId) continue;

        const reward = rewardByPlayer.get(p.id);
        const coins = reward?.coins ?? 0;
        const xp = reward?.xp ?? 0;

        await tx.gameResult.create({
          data: {
            sessionId,
            userId: p.userId,
            position: entry.position,
            patrimony: entry.patrimony,
            xpEarned: xp,
            coinsEarned: coins,
            activityScore: reward?.activityScore ?? 0,
            rewardMultiplier: reward?.multiplier ?? 0,
            penaltyReason: reward?.penaltyReason ?? null,
          },
        });

        const user = await tx.user.findUnique({ where: { id: p.userId } });
        if (!user) continue;

        const { xp: newXp, level: newLevel } = addXp(user.xp, user.level, xp);

        const trophyBefore = user.trophies;
        const trophyDelta  = calcularDeltaTrofeus(trophyBefore, entry.position, ranked.length);
        const trophyAfter  = Math.max(0, trophyBefore + trophyDelta);
        trophyByPlayer.set(p.id, { trophyDelta, trophyBefore, trophyAfter });

        await tx.user.update({
          where: { id: p.userId },
          data: {
            xp: newXp,
            level: newLevel,
            coins: { increment: coins },
            totalGames: { increment: 1 },
            ...(entry.position === 1 ? { totalWins: { increment: 1 } } : {}),
            ...(entry.position <= 3 ? { totalTop3: { increment: 1 } } : {}),
            trophies: trophyAfter,
          },
        });

        await tx.gameResult.update({
          where: { userId_sessionId: { userId: p.userId, sessionId } },
          data: { trophyDelta, trophyBefore, trophyAfter },
        });

        // Auditoria imutável — registra apenas crédito de partida
        if (coins > 0) {
          await tx.coinTransaction.create({
            data: { userId: p.userId, amount: coins, tipo: "PARTIDA", sessionId },
          });
        }
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

    // Invalida cache do ranking — XP/level dos jogadores mudou
    this.rankingService.invalidateCache().catch(() => {});

    // Enfileira concessão de baús pós-partida com retry automático
    const bauPlayers: RecompensasBauJob["players"] = ranked
      .filter((entry: any) => !!entry.player.userId)
      .map((entry: any) => {
        const reward = rewardByPlayer.get(entry.player.id);
        return {
          userId: entry.player.userId as number,
          position: entry.position,
          teveRecompensa: (reward?.coins ?? 0) > 0 || (reward?.xp ?? 0) > 0,
        };
      });

    recompensasQueue
      .add(`bau-${sessionId}`, { sessionId, players: bauPlayers }, { jobId: `bau-${sessionId}` })
      .catch((e) => sessionLogger.warn({ err: e, sessionId }, "falha ao enfileirar baús — baús não serão concedidos"));

    // Enfileira tracking de missões pós-partida com retry automático
    const missaoPlayers: MissoesJob["players"] = ranked
      .filter((entry: any) => !!entry.player.userId)
      .map((entry: any) => ({
        userId: entry.player.userId as number,
        position: entry.position,
      }));

    missoesQueue
      .add(`missoes-${sessionId}`, { sessionId, players: missaoPlayers }, { jobId: `missoes-${sessionId}` })
      .catch((e) => sessionLogger.warn({ err: e, sessionId }, "falha ao enfileirar missões — progresso não será atualizado"));

    // Enriquece o retorno com as recompensas calculadas + motivo de penalidade + troféus + baú
    return ranked.map((entry: any) => {
      const reward  = entry.player.userId ? rewardByPlayer.get(entry.player.id) : null;
      const trophies = entry.player.userId ? trophyByPlayer.get(entry.player.id) : null;
      const teveRecompensa = (reward?.coins ?? 0) > 0 || (reward?.xp ?? 0) > 0;
      const bauEarned: "premium" | "comum" | null =
        teveRecompensa && entry.player.userId
          ? entry.position === 1 ? "premium"
          : entry.position === 2 ? "comum"
          : null
          : null;
      return {
        ...entry,
        xpEarned: reward?.xp ?? 0,
        coinsEarned: reward?.coins ?? 0,
        penaltyReason: reward?.penaltyReason ?? null,
        breakdown: reward?.breakdown ?? [],
        trophyDelta: trophies?.trophyDelta ?? 0,
        trophyBefore: trophies?.trophyBefore ?? 0,
        trophyAfter: trophies?.trophyAfter ?? 0,
        bauEarned,
      };
    });
  }

  private async calculateRankings(session: any) {
    const players = await mapSessionPlayers(session.jogadores ?? []);
    const posses = session.sessionPosses ?? [];

    const withPatrimony = players.map((p: any) => {
      let patrimony = p.saldo;
      if (p.desistiu && p.patrimonyAtDesistir != null) {
        patrimony = p.patrimonyAtDesistir;
      } else {
        for (const sp of posses) {
          if (sp.playerId === p.id && sp.propriedade) {
            patrimony += sp.propriedade.custo_compra;
            patrimony += sp.casas * sp.propriedade.custo_casa;
          }
        }
      }

      // grupo 0 = ativo até o fim; 1 = falência; 2 = desistência voluntária
      // null é tratado como falência para preservar compatibilidade com partidas antigas
      const grupo = !p.desistiu
        ? 0
        : p.motivoDesistencia === "VOLUNTARIA" ? 2 : 1;

      return {
        player: p,
        patrimony,
        grupo,
        desistiuEm: p.desistiuEm as Date | null,
      };
    });

    withPatrimony.sort((a: any, b: any) => {
      if (a.grupo !== b.grupo) return a.grupo - b.grupo;
      if (a.grupo < 2) return b.patrimony - a.patrimony;
      // grupo 2 (voluntários): quem saiu mais tarde é melhor colocado
      const ta = a.desistiuEm?.getTime() ?? 0;
      const tb = b.desistiuEm?.getTime() ?? 0;
      return tb - ta;
    });

    return withPatrimony.map((entry: any, index: number) => ({
      ...entry,
      position: index + 1,
    }));
  }

}
