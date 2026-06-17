import "dotenv/config";
import { initSentry } from "./lib/sentry.js";
initSentry();
import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import apiRouter from "./api/routes/index.js";
import { webhookRouter } from "./api/routes/webhook.routes.js";
import { ensureGameData } from "./utils/ensureGameData.js";
import { seedAdmin } from "./utils/seed-admin.js";
import { seedDiamondPackages } from "./utils/seed-diamond-packages.js";
import { seedBaus } from "./utils/seed-baus.js";
import { errorHandler } from "./middleware/error-handler.middleware.js";
import { initSocket, getIO } from "./lib/socket.js";
import { startNegotiationCleanup } from "./lib/negotiation-cleanup.js";
import { startCronJobs } from "./lib/cron.js";
import { logger } from "./lib/logger.js";
import { initQueueMonitoring, recompensasQueue, missoesQueue, cacheQueue } from "./lib/queues.js";
import { createRecompensasWorker } from "./workers/recompensas.worker.js";
import { createMissoesWorker } from "./workers/missoes.worker.js";
import pinoHttp from "pino-http";
import { prisma } from "./lib/prisma.js";
import { getRedis } from "./lib/redis.js";

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandled promise rejection");
});

const PORT = process.env.PORT || 7000;
const app = express();

// Render (e proxies em geral) injetam X-Forwarded-For; sem isso o express-rate-limit
// lança ERR_ERL_UNEXPECTED_X_FORWARDED_FOR e devolve 500 antes de qualquer middleware
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const corsOriginsEnv = process.env.CORS_ORIGIN?.trim() || "";
const allowedOrigins = corsOriginsEnv
  ? corsOriginsEnv.split(",").map(s => s.trim())
  : ["http://localhost:3000"];

app.use(compression({
  threshold: 1024,
  level: 6,
}));

app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.method === "OPTIONS" || req.url === "/health",
  },
  customLogLevel: (_req, res, err) => {
    if (res.statusCode === 304) return "silent";
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
}));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "http://localhost:7000", "https://gamebank-vtsb.onrender.com"],
        fontSrc: ["'self'", "https:", "data:"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: null,
      },
    },
  })
);
app.use(
  helmet.hsts({ maxAge: 31536000, includeSubDomains: true })
);

app.use(
  cors({
    origin: function (origin, callback) {
      const wildcard = allowedOrigins.includes("*");
      if (!origin || wildcard || allowedOrigins.includes(origin)) {
        callback(null, origin || true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

const baseRateLimit = {
  standardHeaders: true,
  legacyHeaders: false,
};

function createAuthLimiter() {
  return rateLimit({
    ...baseRateLimit,
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Muitas requisições. Tente novamente em 15 minutos." },
  });
}

function createApiLimiter() {
  return rateLimit({
    ...baseRateLimit,
    windowMs: 60 * 1000,
    max: 300,
    message: { message: "Muitas requisições. Tente novamente em 1 minuto." },
  });
}

const httpServer = createServer(app);

// Workers ficam no escopo do módulo para serem acessíveis no graceful shutdown
let recompensasWorker: ReturnType<typeof createRecompensasWorker> | null = null;
let missoesWorker: ReturnType<typeof createMissoesWorker> | null = null;

async function start() {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  await initSocket(httpServer);

  app.use("/webhooks", webhookRouter);

  app.use("/api/auth", createAuthLimiter());
  app.use("/api", createApiLimiter());
  app.use("/api", apiRouter);

  app.use(errorHandler);

  await ensureGameData();
  await seedAdmin();
  await seedDiamondPackages();
  await seedBaus();
  startNegotiationCleanup();
  startCronJobs();
  initQueueMonitoring();

  recompensasWorker = createRecompensasWorker();
  missoesWorker = createMissoesWorker();
  logger.info("workers de recompensas e missões iniciados");

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, "servidor iniciado");
  })
}

start()

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

const SHUTDOWN_TIMEOUT = 30_000;

async function contarPartidasAtivas(): Promise<number> {
  try {
    return await prisma.session.count({
      where: { status: "Em Andamento" },
    });
  } catch {
    return 0;
  }
}

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, "iniciando graceful shutdown");

  // 1. Parar de aceitar novas conexões HTTP
  httpServer.close(() => {
    logger.info("servidor HTTP encerrado — sem novas conexões");
  });

  // 2. Avisar todos os jogadores conectados via Socket.IO
  try {
    getIO().emit("servidor:reiniciando", {
      mensagem: "Servidor reiniciando em breve. Sua sessão será preservada.",
      em: 10_000,
    });
  } catch {
    // io pode não estar inicializado se o boot falhou
  }

  // 3. Aguardar partidas ativas terminarem (até SHUTDOWN_TIMEOUT)
  const inicio = Date.now();
  let partidasAtivas = await contarPartidasAtivas();
  logger.info({ partidasAtivas }, "aguardando partidas ativas");

  while (partidasAtivas > 0 && Date.now() - inicio < SHUTDOWN_TIMEOUT) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    partidasAtivas = await contarPartidasAtivas();
    logger.info({ partidasAtivas, elapsed: Date.now() - inicio }, "shutdown aguardando...");
  }

  if (partidasAtivas > 0) {
    logger.warn({ partidasAtivas }, "timeout atingido com partidas ativas — encerrando forçado");
  }

  // 4. Encerrar conexões Socket.IO
  try {
    await new Promise<void>(resolve => getIO().close(() => resolve()));
    logger.info("socket.io encerrado");
  } catch {
    // io pode não estar inicializado
  }

  // 5. Encerrar workers e filas BullMQ
  try {
    await Promise.all([
      recompensasWorker?.close(),
      missoesWorker?.close(),
      recompensasQueue.close(),
      missoesQueue.close(),
      cacheQueue.close(),
    ]);
    logger.info("workers e filas BullMQ encerrados");
  } catch (err) {
    logger.warn({ err }, "erro ao encerrar workers/filas BullMQ");
  }

  // 7. Fechar conexão Redis
  const redis = getRedis();
  if (redis) {
    try {
      await redis.quit();
      logger.info("redis desconectado");
    } catch (err) {
      logger.warn({ err }, "erro ao desconectar redis");
    }
  }

  // 8. Fechar conexão com banco de dados
  try {
    await prisma.$disconnect();
    logger.info("banco de dados desconectado");
  } catch (err) {
    logger.warn({ err }, "erro ao desconectar banco");
  }

  logger.info("graceful shutdown concluído");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaught exception — encerrando");
  process.exit(1);
});