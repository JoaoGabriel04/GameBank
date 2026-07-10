import { Queue, QueueEvents } from "bullmq";
import { logger } from "./logger.js";

// BullMQ usa ioredis internamente — conexão separada do cliente principal
//
// maxRetriesPerRequest: null e enableReadyCheck: false são exigidos pelo BullMQ
// para Worker/QueueEvents (usam comandos bloqueantes tipo BRPOPLPUSH). Sem isso,
// uma instabilidade momentânea no Redis do Render (ECONNRESET) esgota as 20
// tentativas padrão do ioredis e lança MaxRetriesPerRequestError sem parar —
// poluindo os logs. O retryStrategy customizado evita reconexões agressivas.
function parseBullMQConnection() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379"),
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1)) || 0 : 0,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => Math.min(times * 500, 10_000),
    };
  } catch {
    return {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => Math.min(times * 500, 10_000),
    };
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

// Sem listener de "error", uma queda de conexão do ioredis (ECONNRESET) é
// lançada como exceção não tratada e polui o stdout — aqui é roteada pro logger.
[recompensasQueue, missoesQueue, cacheQueue].forEach((fila) => {
  fila.on("error", (err) => {
    logger.warn({ fila: fila.name, err: err.message }, "erro de conexão na fila (redis)");
  });
});

export function initQueueMonitoring() {
  const filas = [
    { nome: "recompensas-partida", fila: recompensasQueue },
    { nome: "progresso-missoes", fila: missoesQueue },
    { nome: "cache-invalidation", fila: cacheQueue },
  ];

  filas.forEach(({ nome }) => {
    const events = new QueueEvents(nome, { connection });

    events.on("error", (err) => {
      logger.warn({ fila: nome, err: err.message }, "erro de conexão no QueueEvents (redis)");
    });

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
