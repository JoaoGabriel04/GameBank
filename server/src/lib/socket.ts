import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyToken, verifyRoomToken } from "./jwt.js";
import { connectRedis, getRedis } from "./redis.js";
import { socketLogger } from "./logger.js";
import { socketRateLimit } from "../middleware/socket-rate-limit.js";
import { validateSequence } from "../middleware/sequence-validator.js";

let io: Server | null = null;
let gameNsp: ReturnType<Server["of"]> | null = null;

// Fallback em memória para quando Redis está offline
const activeSockets = new Map<number, string>(); // userId → socketId
const socketOwners = new Map<string, number>();   // socketId → userId

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO não foi inicializado");
  return io;
}

export function emitToPlayer(sessionId: number, playerId: number, event: string, data: unknown) {
  const nsp = getIO().of("/game");
  const roomSockets = nsp.adapter.rooms?.get(`session:${sessionId}`);
  if (!roomSockets) return;

  for (const socketId of roomSockets) {
    const socket = nsp.sockets.get(socketId);
    if (socket?.data.playerId === playerId) {
      socket.emit(event, data);
    }
  }
}

// Emite para um usuário específico via Redis (cross-instância) ou activeSockets (fallback).
// Usa nsp.to(socketId) que funciona com Redis adapter entre instâncias.
export async function emitToUser(userId: number, event: string, data: unknown) {
  const nsp = getIO().of("/game");
  const redis = getRedis();
  let socketId: string | null = null;

  if (redis) {
    socketId = await redis.get(`user:socket:${userId}`);
  } else {
    socketId = activeSockets.get(userId) || null;
  }

  if (!socketId) {
    socketLogger.warn({ userId, event }, "emitToUser falhou: usuário sem socket");
    return false;
  }
  nsp.to(socketId).emit(event, data);
  return true;
}

// Emite para uma sala (broadcast) — mais confiável que emitToUser para notificações
// pois não depende de socket lookup individual que pode estar stale.
// O cliente filtra por targetUserId no payload.
export function emitToRoom(sessionId: number, event: string, data: unknown) {
  const nsp = getIO().of("/game");
  const roomName = `session:${sessionId}`;
  nsp.to(roomName).emit(event, data);
}

// Emite com retry automático — tenta novamente após 50ms se socket não estiver pronto
export async function emitToUserWithRetry(userId: number, event: string, data: unknown, maxRetries: number = 2): Promise<boolean> {
  const nsp = getIO().of("/game");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const redis = getRedis();
    let socketId: string | null = null;

    if (redis) {
      socketId = await redis.get(`user:socket:${userId}`);
    } else {
      socketId = activeSockets.get(userId) || null;
    }

    if (!socketId) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }
      socketLogger.warn({ userId, event }, "emitToUserWithRetry exauriu tentativas");
      return false;
    }

    // nsp.to(socketId) funciona cross-instância com Redis adapter
    nsp.to(socketId).emit(event, data);
    return true;
  }

  return false;
}

export async function initSocket(httpServer: HttpServer) {
  const corsOrigins = process.env.CORS_ORIGIN?.split(",").map(s => s.trim()) || ["http://localhost:3000"];
  const corsWildcard = corsOrigins.includes("*");

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || corsWildcard || corsOrigins.includes(origin)) {
          cb(null, corsWildcard && origin ? origin : true);
        } else {
          cb(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    },
    perMessageDeflate: {
      zlibDeflateOptions: { level: 6 },
      threshold: 1024,
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
    },
  });

  await setupRedisAdapter(io);

  gameNsp = io.of("/game");

  gameNsp.on("connection", (socket: Socket) => {
    socket.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNRESET") return;
      socketLogger.error({ err, socketId: socket.id }, "socket error");
    });

    const token = socket.handshake.auth?.token;

    if (token) {
      try {
        const payload = verifyToken(token);
        socket.data.userId = payload.userId;
      } catch {
        socket.data.userId = null;
      }
    }

    socket.on("session:join", async ({ sessionId }: { sessionId: number }) => {
      try {
        const { prisma } = await import("../lib/prisma.js");
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { id: true, senha: true },
        });

        if (!session) {
          socket.emit("error", { message: "Sessão não encontrada" });
          return;
        }

        // Sala pública — acesso livre
        if (!session.senha) {
          socket.join(`session:${sessionId}`);
          socket.data.sessionId = sessionId;
          await registerActiveSocket(socket);
          await setSocketPlayerId(socket, sessionId);
          await loadChatHistory(socket, sessionId);
          // Entrega mensagens que não foram entregues na reconexão
          await deliverQueuedMessages(socket);
          // Reenvia votação ativa para este socket (persistência após refresh)
          await deliverActiveVote(socket, sessionId);
          // Notifica cliente que está pronto para receber eventos
          socket.emit("socket:ready", { sessionId });
          return;
        }

        // Sala com senha — exige token, a menos que usuário JWT já seja jogador
        const userId = socket.data.userId;
        if (userId) {
          const isPlayer = await prisma.sessionPlayer.findFirst({
            where: { userId, sessionId },
            select: { id: true },
          });
          if (isPlayer) {
            socket.join(`session:${sessionId}`);
            socket.data.sessionId = sessionId;
            await registerActiveSocket(socket);
            await setSocketPlayerId(socket, sessionId);
            await loadChatHistory(socket, sessionId);
            await deliverQueuedMessages(socket);
            await deliverActiveVote(socket, sessionId);
            socket.emit("socket:ready", { sessionId });
            return;
          }
        }

        // Valida token de sala (cookie ou auth)
        const cookies = socket.handshake.headers.cookie || "";
        const roomCookieMatch = cookies.match(new RegExp(`room_token_${sessionId}=([^;]+)`));
        const token = roomCookieMatch?.[1] || socket.handshake.auth?.roomToken;
        if (!token) {
          socket.emit("error", { message: "Acesso não autorizado a esta sala" });
          return;
        }

        const payload = verifyRoomToken(token);
        if (payload.sessionId === sessionId) {
          socket.join(`session:${sessionId}`);
          socket.data.sessionId = sessionId;
          await registerActiveSocket(socket);
          await setSocketPlayerId(socket, sessionId);
          await loadChatHistory(socket, sessionId);
          await deliverQueuedMessages(socket);
          await deliverActiveVote(socket, sessionId);
          socket.emit("socket:ready", { sessionId });
        } else {
          socket.emit("error", { message: "Token não pertence a esta sala" });
        }
      } catch {
        socket.emit("error", { message: "Token de sala inválido ou expirado" });
      }
    });

    // --- Votação para encerrar partida ---
    socket.on("game:request_end", async () => {
      const sessionId = socket.data.sessionId;
      const userId = socket.data.userId;
      if (!sessionId || !userId) return;

      try {
        const { prisma } = await import("../lib/prisma.js");
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: {
            id: true, status: true, ownerId: true,
            jogadores: { where: { desistiu: false }, select: { userId: true, nome: true } },
          },
        });
        if (!session || session.status !== "Em Andamento") return;
        if (session.ownerId !== userId) return;

        const owner = session.jogadores.find((j: any) => j.userId === userId);
        const ownerNome = owner?.nome ?? "Dono";
        const otherPlayers = session.jogadores.filter((j: any) => j.userId !== userId && j.userId != null);
        const requiredUserIds = otherPlayers.map((j: any) => j.userId as number);
        const playerNames: Record<number, string> = {};
        for (const j of otherPlayers) {
          if (j.userId) playerNames[j.userId as number] = j.nome;
        }

        // Se não há outros jogadores ativos, encerra direto
        if (requiredUserIds.length === 0) {
          const { SessionService } = await import("../modules/session/session.service.js");
          const svc = new SessionService();
          const ranking = await svc.endSession(sessionId, userId);
          const { emitSessionClosed } = await import("../modules/socket/socket.handler.js");
          emitSessionClosed(sessionId, ranking);
          return;
        }

        const { initiateVote } = await import("../modules/session/vote.service.js");
        await initiateVote(sessionId, userId, ownerNome, requiredUserIds);

        const { emitVoteRequest } = await import("../modules/socket/socket.handler.js");
        emitVoteRequest(sessionId, { ownerId: userId, ownerNome, requiredUserIds, playerNames });
      } catch (err) {
        socketLogger.error({ err, sessionId, userId }, "game:request_end falhou");
      }
    });

    socket.on("game:vote", async ({ vote }: { vote: "yes" | "no" }) => {
      const sessionId = socket.data.sessionId;
      const userId = socket.data.userId;
      if (!sessionId || !userId || (vote !== "yes" && vote !== "no")) return;

      try {
        const { castVote } = await import("../modules/session/vote.service.js");
        const result = await castVote(sessionId, userId, vote);
        if (!result) return;

        const { emitVoteUpdate, emitVoteCancelled, emitSessionClosed } =
          await import("../modules/socket/socket.handler.js");

        if (result.cancelled) {
          // Alguém votou NÃO — cancela a votação
          const { prisma } = await import("../lib/prisma.js");
          const player = await prisma.sessionPlayer.findFirst({
            where: { sessionId, userId },
            select: { nome: true },
          });
          emitVoteCancelled(sessionId, player?.nome ?? undefined);
          return;
        }

        if (result.resolved) {
          // Todos votaram SIM — encerra a partida
          const { SessionService } = await import("../modules/session/session.service.js");
          const svc = new SessionService();
          const ranking = await svc.endSession(sessionId);
          emitSessionClosed(sessionId, ranking);
          return;
        }

        // Atualiza contagem de votos para todos
        emitVoteUpdate(sessionId, { votes: result.votes, requiredUserIds: result.requiredUserIds });
      } catch (err) {
        socketLogger.error({ err, sessionId, userId }, "game:vote falhou");
      }
    });

    // --- Votação de expulsão ---
    socket.on("game:kick_vote_init", async ({ targetPlayerId }: { targetPlayerId: number }) => {
      const sessionId = socket.data.sessionId;
      const userId = socket.data.userId;
      if (!sessionId || !userId || !targetPlayerId) return;

      try {
        const { prisma } = await import("../lib/prisma.js");

        // Verifica que não há outra votação de expulsão ativa
        const { getActiveKickVote } = await import("../modules/session/vote.service.js");
        const existing = await getActiveKickVote(sessionId);
        if (existing) return; // só uma votação por vez

        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: {
            id: true, status: true,
            // Jogadores ativos: desistiu:false exclui espectadores e desistentes
            jogadores: { where: { desistiu: false }, select: { id: true, userId: true, nome: true } },
          },
        });
        if (!session || session.status !== "Em Andamento") return;

        // Iniciador deve ser jogador ativo
        const initiator = session.jogadores.find((j: any) => j.userId === userId);
        if (!initiator) return;

        // Alvo deve ser jogador ativo diferente do iniciador
        const target = session.jogadores.find((j: any) => j.id === targetPlayerId);
        if (!target || target.userId === userId) return;

        // Elegíveis = todos ativos exceto o alvo (iniciador já vota SIM automaticamente)
        const eligible = session.jogadores.filter((j: any) => j.id !== targetPlayerId && j.userId != null);
        const requiredUserIds = eligible.map((j: any) => j.userId as number);
        const playerNames: Record<number, string> = {};
        for (const j of eligible) { if (j.userId) playerNames[j.userId as number] = j.nome; }

        const { initiateKickVote } = await import("../modules/session/vote.service.js");
        const state = await initiateKickVote(
          sessionId, userId, initiator.nome,
          targetPlayerId, target.userId, target.nome,
          requiredUserIds, playerNames
        );

        const { emitKickVoteRequest } = await import("../modules/socket/socket.handler.js");
        emitKickVoteRequest(sessionId, {
          targetPlayerId, targetNome: target.nome,
          initiatorNome: initiator.nome,
          requiredUserIds, playerNames,
          votes: state.votes,
          expiresAt: state.expiresAt,
        });

        // Expira após 60s se não resolvida antes
        setTimeout(async () => {
          const { getActiveKickVote: stillActive, cancelKickVote } =
            await import("../modules/session/vote.service.js");
          const stillState = await stillActive(sessionId);
          if (!stillState || stillState.targetPlayerId !== targetPlayerId) return;
          await cancelKickVote(sessionId);
          const { emitKickVoteResult } = await import("../modules/socket/socket.handler.js");
          emitKickVoteResult(sessionId, { passed: false, targetNome: target.nome, targetPlayerId });
        }, 60_000);
      } catch (err) {
        socketLogger.error({ err, sessionId, userId }, "game:kick_vote_init falhou");
      }
    });

    socket.on("game:kick_vote", async ({ vote }: { vote: "yes" | "no" }) => {
      const sessionId = socket.data.sessionId;
      const userId = socket.data.userId;
      if (!sessionId || !userId || (vote !== "yes" && vote !== "no")) return;

      try {
        const { castKickVote } = await import("../modules/session/vote.service.js");
        const result = await castKickVote(sessionId, userId, vote);
        if (!result) return;

        const { emitKickVoteUpdate, emitKickVoteResult, emitUpdatedSession } =
          await import("../modules/socket/socket.handler.js");

        if (!result.finished) {
          emitKickVoteUpdate(sessionId, { votes: result.votes, requiredUserIds: result.requiredUserIds });
          return;
        }

        emitKickVoteResult(sessionId, {
          passed: result.passed,
          targetNome: result.targetNome,
          targetPlayerId: result.targetPlayerId,
        });

        if (result.passed) {
          const { SessionService } = await import("../modules/session/session.service.js");
          const svc = new SessionService();
          const kickResult = await svc.kickPlayer(sessionId, result.targetPlayerId);
          if (kickResult.autoEnded) {
            const { emitSessionClosed } = await import("../modules/socket/socket.handler.js");
            emitSessionClosed(sessionId, kickResult.ranking);
          } else {
            await emitUpdatedSession(sessionId);
          }
        }
      } catch (err) {
        socketLogger.error({ err, sessionId, userId }, "game:kick_vote falhou");
      }
    });

    async function loadChatHistory(socket: Socket, sessionId: number) {
      try {
        const { prisma } = await import("../lib/prisma.js");
        const messages = await prisma.message.findMany({
          where: { sessionId },
          include: { player: { select: { id: true, nome: true } } },
          orderBy: { createdAt: "asc" },
          take: 100,
        });
        socket.emit("chat:history", messages.map(m => ({
          id: m.id,
          playerId: m.player.id,
          playerNome: m.player.nome,
          texto: m.texto,
          createdAt: m.createdAt.toISOString(),
        })));
      } catch (err) {
        socketLogger.error({ err }, "chat erro ao carregar histórico");
      }
    }

    socket.on("session:leave", async (sessionId: number) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on("chat:send", async ({ texto, seq }: { texto: string; seq?: number }) => {
      const sessionId = socket.data.sessionId;
      const userId = socket.data.userId;
      if (!sessionId || !userId || !texto || !texto.trim()) return;

      const permitido = await socketRateLimit(socket, {
        evento: "chat",
        limite: 20,
        janela: 10,
        mensagem: "Aguarde um momento antes de enviar mais mensagens.",
      });
      if (!permitido) return;

      // Período de transição: clientes sem seq são aceitos com warning
      if (seq === undefined) {
        socketLogger.warn({ userId, sessionId }, "chat:send sem seq — cliente desatualizado");
      } else {
        const valido = await validateSequence(socket, sessionId, seq);
        if (!valido) return;
      }

      try {
        const { prisma } = await import("../lib/prisma.js");
        // userId do JWT é User.id — busca o SessionPlayer vinculado a esta sessão
        const player = await prisma.sessionPlayer.findFirst({
          where: { sessionId, userId },
          select: { id: true, nome: true },
        });
        if (!player) return;

        const message = await prisma.message.create({
          data: {
            sessionId,
            playerId: player.id,
            texto: texto.trim(),
          },
        });

        const { emitChatMessage } = await import("../modules/socket/socket.handler.js");
        emitChatMessage(sessionId, {
          id: message.id,
          playerId: player.id,
          playerNome: player.nome,
          texto: texto.trim(),
          createdAt: message.createdAt.toISOString(),
        });
      } catch (err) {
        socketLogger.error({ err }, "chat erro ao enviar mensagem");
      }
    });

    socket.on("disconnect", async () => {
      await unregisterActiveSocket(socket);
    });
  });

  return io;
}

async function setupRedisAdapter(io: Server) {
  try {
    const redis = await connectRedis();
    if (!redis) {
      socketLogger.warn("redis não disponível — socket.io sem adapter (single-instância)");
      return;
    }

    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    socketLogger.info("redis adapter configurado");
  } catch {
    socketLogger.warn("redis adapter não configurado — modo single-instância");
  }
}

async function registerActiveSocket(socket: Socket) {
  const userId = socket.data.userId;
  if (!userId) return;

  // Tenta remover sessão anterior deste usuário
  const redis = getRedis();
  let oldSocketId: string | null = null;

  if (redis) {
    oldSocketId = await redis.get(`user:socket:${userId}`);
  } else {
    oldSocketId = activeSockets.get(userId) || null;
  }

  if (oldSocketId && oldSocketId !== socket.id) {
    // Notifica o socket antigo antes de desconectar
    const oldSocket = gameNsp?.sockets.get(oldSocketId);
    if (oldSocket?.connected) {
      oldSocket.emit("force_disconnect", {
        reason: "Você entrou em outro dispositivo.",
      });
    }
    // Desconecta após breve delay para permitir que a mensagem seja entregue
    setTimeout(() => {
      oldSocket?.disconnect(true);
    }, 100);
  }

  // Registra novo socket
  if (redis) {
    await redis.set(`user:socket:${userId}`, socket.id);
  }
  activeSockets.set(userId, socket.id);
  socketOwners.set(socket.id, userId);
}

async function setSocketPlayerId(socket: Socket, sessionId: number) {
  const userId = socket.data.userId;
  if (!userId) {
    socketLogger.warn("setSocketPlayerId: socket sem userId — playerId não será definido");
    return;
  }
  try {
    const { prisma } = await import("../lib/prisma.js");
    const player = await prisma.sessionPlayer.findFirst({
      where: { sessionId, userId },
      select: { id: true },
    });
    if (player) {
      socket.data.playerId = player.id;
    }
  } catch (err) {
    socketLogger.warn({ err, userId, sessionId }, "setSocketPlayerId falhou — playerId ficará undefined");
  }
}

// Enfileira mensagem não entregue em Redis para entrega futura
async function queueUndeliveredMessage(userId: number, event: string, data: unknown) {
  const redis = getRedis();
  if (!redis) return;

  try {
    const queueKey = `msg:queue:${userId}`;
    const message = { event, data, timestamp: Date.now() };
    // Mantém apenas últimas 100 mensagens por usuário (TTL de 24h)
    await redis.rPush(queueKey, JSON.stringify(message));
    await redis.expire(queueKey, 86400);
    socketLogger.debug({ userId, event }, "mensagem enfileirada");
  } catch (err) {
    socketLogger.error({ err, userId, event }, "erro ao enfileirar mensagem");
  }
}

// Entrega mensagens enfileiradas quando socket se reconecta
async function deliverQueuedMessages(socket: Socket) {
  const userId = socket.data.userId;
  if (!userId) return;

  const redis = getRedis();
  if (!redis) return;

  try {
    const queueKey = `msg:queue:${userId}`;
    const messages = await redis.lRange(queueKey, 0, -1);

    if (messages.length === 0) return;

    let delivered = 0;
    for (const msgStr of messages) {
      try {
        const { event, data } = JSON.parse(msgStr);
        socket.emit(event, data);
        delivered++;
      } catch {
        // Skip mensagens malformadas
      }
    }

    // Limpa a fila após entrega
    await redis.del(queueKey);

    if (delivered > 0) {
      socketLogger.debug({ userId, delivered }, "mensagens enfileiradas entregues");
    }
  } catch (err) {
    socketLogger.error({ err, userId }, "erro ao entregar mensagens enfileiradas");
  }
}

async function deliverActiveVote(socket: Socket, sessionId: number) {
  try {
    const { getActiveVote, getActiveKickVote } = await import("../modules/session/vote.service.js");

    // Voto de encerramento
    const vote = await getActiveVote(sessionId);
    if (vote) {
      const { prisma } = await import("../lib/prisma.js");
      const players = await prisma.sessionPlayer.findMany({
        where: { sessionId, userId: { in: vote.requiredUserIds } },
        select: { userId: true, nome: true },
      });
      const playerNames: Record<number, string> = {};
      for (const p of players) { if (p.userId) playerNames[p.userId] = p.nome; }
      socket.emit("game:vote_request", {
        sessionId: vote.sessionId,
        ownerId: vote.ownerId,
        ownerNome: vote.ownerNome,
        requiredUserIds: vote.requiredUserIds,
        playerNames,
        currentVotes: vote.votes,
      });
    }

    // Voto de expulsão
    const kick = await getActiveKickVote(sessionId);
    if (kick) {
      socket.emit("game:kick_vote_request", {
        sessionId: kick.sessionId,
        targetPlayerId: kick.targetPlayerId,
        targetNome: kick.targetNome,
        initiatorNome: kick.initiatorNome,
        requiredUserIds: kick.requiredUserIds,
        playerNames: kick.playerNames,
        votes: kick.votes,
        expiresAt: kick.expiresAt,
      });
    }
  } catch {
    // silently fail — não bloqueia a conexão
  }
}

async function unregisterActiveSocket(socket: Socket) {
  const userId = socket.data.userId;
  const sessionId = socket.data.sessionId;

  // Remove dos rooms
  if (sessionId) {
    socket.leave(`session:${sessionId}`);
  }

  // Remove do tracking apenas se este socket ainda é o dono
  const currentOwner = socketOwners.get(socket.id);
  if (!currentOwner) return;

  const redis = getRedis();
  if (redis) {
    const storedSocketId = await redis.get(`user:socket:${userId}`);
    if (storedSocketId === socket.id) {
      await redis.del(`user:socket:${userId}`);
    }
  }

  if (activeSockets.get(userId) === socket.id) {
    activeSockets.delete(userId);
  }
  socketOwners.delete(socket.id);
}
