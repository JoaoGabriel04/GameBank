import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyToken, verifyRoomToken } from "./jwt.js";
import { connectRedis, getRedis } from "./redis.js";

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
  });

  await setupRedisAdapter(io);

  gameNsp = io.of("/game");

  gameNsp.on("connection", (socket: Socket) => {
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
          // Carrega mensagens anteriores do chat
          await loadChatHistory(socket, sessionId);
          return;
        }

        // Sala com senha — valida token (cookie específico da sala ou token do auth)
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
        } else {
          socket.emit("error", { message: "Token não pertence a esta sala" });
        }
      } catch {
        socket.emit("error", { message: "Token de sala inválido ou expirado" });
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
        console.error("[Chat] Erro ao carregar histórico:", err);
      }
    }

    socket.on("session:leave", async (sessionId: number) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on("chat:send", async ({ texto }: { texto: string }) => {
      const sessionId = socket.data.sessionId;
      const userId = socket.data.userId;
      if (!sessionId || !userId || !texto || !texto.trim()) return;

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
        console.error("[Chat] Erro ao enviar mensagem:", err);
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
      console.warn("[Socket.IO] Redis não disponível — rodando sem adapter (single-instância)");
      return;
    }

    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log("[Socket.IO] Redis adapter configurado");
  } catch {
    console.warn("[Socket.IO] Redis adapter não configurado — modo single-instância");
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
    // Notifica e desconecta o socket antigo (funciona cross-instância com Redis adapter)
    gameNsp?.to(oldSocketId).emit("force_disconnect", {
      reason: "Você entrou em outro dispositivo.",
    });
    const oldSocket = gameNsp?.sockets.get(oldSocketId);
    oldSocket?.disconnect(true);
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
  if (!userId) return;
  try {
    const { prisma } = await import("../lib/prisma.js");
    const player = await prisma.sessionPlayer.findFirst({
      where: { sessionId, userId },
      select: { id: true },
    });
    if (player) {
      socket.data.playerId = player.id;
    }
  } catch {
    // Silencia erro — playerId fica undefined
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
