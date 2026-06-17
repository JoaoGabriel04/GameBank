import { Socket } from "socket.io";
import { getRedis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

// TTL = duração máxima razoável de uma partida (2h)
const SEQ_TTL_S = 7200;

export async function validateSequence(
  socket: Socket,
  sessionId: number,
  seq: number
): Promise<boolean> {
  const userId = socket.data.userId;
  const key = `seq:${sessionId}:${userId}`;

  const redis = getRedis();
  if (!redis) return true; // Redis indisponível — permitir sem bloquear

  try {
    const lastSeqStr = await redis.get(key);
    const lastSeq = lastSeqStr !== null ? parseInt(lastSeqStr) : -1;

    // seq = 0 significa reconexão — resetar contador
    if (seq === 0) {
      await redis.set(key, "0", { EX: SEQ_TTL_S });
      return true;
    }

    if (seq !== lastSeq + 1) {
      logger.warn(
        { userId, sessionId, esperado: lastSeq + 1, recebido: seq },
        "evento com sequência inválida — rejeitando"
      );
      socket.emit("erro:sequencia", {
        esperado: lastSeq + 1,
        recebido: seq,
        mensagem: "Evento fora de ordem. Recarregue a página se o problema persistir.",
      });
      return false;
    }

    await redis.set(key, String(seq), { EX: SEQ_TTL_S });
    return true;
  } catch (err) {
    // Redis falhou — permitir para não quebrar o jogo
    logger.warn({ err, userId, sessionId }, "redis indisponível na validação de sequência — permitindo");
    return true;
  }
}
