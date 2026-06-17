import { Queue, QueueEvents } from "bullmq";
import { logger } from "./logger.js";

// BullMQ usa ioredis internamente — conexão separada do cliente principal
function parseBullMQConnection() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379"),
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1)) || 0 : 0,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

export const bullMQConnection = parseBullMQConnection();
const connection = bullMQConnection;

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2000,
  },
  removeOnComplete: {
    age: 86400,
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 86400,
  },
};

export const recompensasQueue = new Queue("recompensas-partida", {
  connection,
  defaultJobOptions,
});

export const missoesQueue = new Queue("progresso-missoes", {
  connection,
  defaultJobOptions,
});

export const cacheQueue = new Queue("cache-invalidation", {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 5 },
});

export function initQueueMonitoring() {
  const filas = [
    { nome: "recompensas-partida", fila: recompensasQueue },
    { nome: "progresso-missoes", fila: missoesQueue },
    { nome: "cache-invalidation", fila: cacheQueue },
  ];

  filas.forEach(({ nome }) => {
    const events = new QueueEvents(nome, { connection });

    events.on("completed", ({ jobId }) => {
      logger.info({ fila: nome, jobId }, "job concluído");
    });

    events.on("failed", ({ jobId, failedReason }) => {
      logger.error({ fila: nome, jobId, motivo: failedReason }, "job falhou");
    });

    events.on("stalled", ({ jobId }) => {
      logger.warn({ fila: nome, jobId }, "job travado — será reprocessado");
    });
  });

  logger.info("monitoramento de filas iniciado");
}
