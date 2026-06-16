import { Socket } from "socket.io";
import { getRedis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

type RateLimitOptions = {
  evento: string;
  limite: number;
  janela: number;
  mensagem?: string;
};

export async function socketRateLimit(
  socket: Socket,
  opts: RateLimitOptions
): Promise<boolean> {
  const userId = socket.data.userId ?? socket.id;
  const key = `rl:socket:${opts.evento}:${userId}`;

  const redis = getRedis();
  if (!redis) return true;

  try {
    const pipeline = redis.multi();
    pipeline.incr(key);
    pipeline.expire(key, opts.janela);
    const results = await pipeline.exec();

    const count = (results?.[0] as unknown as number | null) ?? 0;

    if (count > opts.limite) {
      logger.warn(
        { userId, evento: opts.evento, count, limite: opts.limite },
        "socket rate limit excedido"
      );
      socket.emit("erro:rate-limit", {
        evento: opts.evento,
        mensagem: opts.mensagem ?? "Muitas ações em pouco tempo. Aguarde.",
        aguardar: opts.janela,
      });
      return false;
    }

    return true;
  } catch (err) {
    // Redis indisponível — permitir sem bloquear
    logger.warn({ err, userId, evento: opts.evento }, "redis indisponível no rate limit — permitindo");
    return true;
  }
}
