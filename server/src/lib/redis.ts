import { createClient, type RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType> {
  if (redisClient?.isOpen) return redisClient;

  redisClient = createClient({ url: REDIS_URL });

  redisClient.on("error", (err) => {
    console.error("[Redis] Erro:", err.message);
  });

  redisClient.on("connect", () => {
    console.log("[Redis] Conectado");
  });

  redisClient.on("end", () => {
    console.warn("[Redis] Conexão encerrada");
  });

  try {
    await redisClient.connect();
  } catch (err) {
    console.error("[Redis] Falha ao conectar:", err);
    redisClient = null;
    throw err;
  }

  return redisClient;
}

export function getRedis(): RedisClientType | null {
  return redisClient?.isOpen ? redisClient : null;
}
