import { getRedis } from "../lib/redis.js";
import { AppError } from "./error-handler.middleware.js";

const LOCK_TTL_MS = 10_000;

export async function withLock(resourceId: string, action: () => Promise<any>) {
  const redis = getRedis();
  if (!redis) {
    // Sem Redis — executa sem lock (single-instância)
    return action();
  }

  const lockKey = `lock:${resourceId}`;
  const acquired = await redis.set(lockKey, "locked", { NX: true, PX: LOCK_TTL_MS });
  if (!acquired) {
    throw new AppError(423, "Recurso ocupado. Tente novamente.");
  }

  try {
    return await action();
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
}
