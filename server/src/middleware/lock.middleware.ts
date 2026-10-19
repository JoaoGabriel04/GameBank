import { randomUUID } from "node:crypto";
import { getRedis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { comFilaDeEmits } from "../lib/fila-de-emits.js";
import { AppError } from "./error-handler.middleware.js";

const LOCK_TTL_MS = 10_000;
// Quanto esperar por um lock ocupado antes de devolver 423. Cobre o duplo
// clique e a corrida contra o timeout de turno: a segunda requisição espera
// a primeira terminar e recebe a resposta de negócio, não um erro genérico.
const ESPERA_MAX_MS = 1_500;
const ESPERA_INICIAL_MS = 25;
const ESPERA_TETO_MS = 200;

// Só apaga o lock se ele ainda for desta aquisição. Se a ação passou do TTL
// e outra requisição já pegou o lock, apagar sem conferir liberaria o lock
// DELA e deixaria duas ações rodando ao mesmo tempo.
const LIBERAR_LUA = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

// Sem Redis (dev, testes, ou Redis fora do ar) o lock vale dentro deste
// processo, com o mesmo contrato (token, TTL, espera) — antes, sem Redis,
// a ação rodava sem lock nenhum.
const locksEmMemoria = new Map<string, { token: string; expiraEm: number }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tentarAdquirir(chave: string, token: string, ttlMs: number): Promise<boolean> {
  const redis = getRedis();
  if (redis) return !!(await redis.set(chave, token, { NX: true, PX: ttlMs }));

  const atual = locksEmMemoria.get(chave);
  if (atual && atual.expiraEm > Date.now()) return false;
  locksEmMemoria.set(chave, { token, expiraEm: Date.now() + ttlMs });
  return true;
}

async function liberar(chave: string, token: string) {
  const redis = getRedis();
  if (redis) {
    await redis.eval(LIBERAR_LUA, { keys: [chave], arguments: [token] });
    return;
  }
  if (locksEmMemoria.get(chave)?.token === token) locksEmMemoria.delete(chave);
}

export async function withLock(
  resourceId: string,
  action: () => Promise<any>,
  opcoes: { ttlMs?: number } = {}
) {
  const chave = `lock:${resourceId}`;
  const ttlMs = opcoes.ttlMs ?? LOCK_TTL_MS;
  const token = randomUUID();

  const inicioEspera = Date.now();
  let espera = ESPERA_INICIAL_MS;
  while (!(await tentarAdquirir(chave, token, ttlMs))) {
    if (Date.now() - inicioEspera + espera > ESPERA_MAX_MS) {
      throw new AppError(423, "Recurso ocupado. Tente novamente.");
    }
    // Backoff exponencial com jitter: evita que várias requisições presas no
    // mesmo lock acordem juntas.
    await sleep(espera + Math.random() * (espera / 2));
    espera = Math.min(espera * 2, ESPERA_TETO_MS);
  }

  const adquiridoEm = Date.now();
  try {
    // Broadcasts da ação saem coalescidos no fim do escopo, ainda com o
    // lock na mão (ver lib/fila-de-emits.ts).
    return await comFilaDeEmits(action, async (sessionId) => {
      const { emitirSnapshotAgora } = await import("../modules/socket/socket.handler.js");
      await emitirSnapshotAgora(sessionId);
    });
  } finally {
    const duracaoMs = Date.now() - adquiridoEm;
    if (duracaoMs > ttlMs) {
      logger.warn({ resourceId, duracaoMs, ttlMs }, "lock expirou antes de a ação terminar");
    }
    await liberar(chave, token).catch((err) => {
      logger.warn({ err, resourceId }, "falha ao liberar lock");
    });
  }
}
