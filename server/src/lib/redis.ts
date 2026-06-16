import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType> {
  if (redisClient?.isOpen) return redisClient;

  redisClient = createClient({ url: REDIS_URL });

  redisClient.on("error", (err) => {
    logger.error({ err: err.message }, "redis erro");
  });

  redisClient.on("connect", () => {
    logger.info("redis conectado");
  });

  redisClient.on("end", () => {
    logger.warn("redis conexão encerrada");
  });

  try {
    await redisClient.connect();
  } catch (err) {
    logger.error({ err }, "redis falha ao conectar");
    redisClient = null;
    throw err;
  }

  return redisClient;
}

export function getRedis(): RedisClientType | null {
  return redisClient?.isOpen ? redisClient : null;
}
