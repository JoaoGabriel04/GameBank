import { getRedis } from "../../lib/redis.js";

const VOTE_TTL_SECONDS = 120;

interface VoteState {
  sessionId: number;
  ownerId: number;
  ownerNome: string;
  requiredUserIds: number[]; // userId de cada jogador ativo (excluindo dono)
  votes: Record<number, "yes" | "no">; // userId → voto
  startedAt: string;
}

function key(sessionId: number) {
  return `vote:end:${sessionId}`;
}

export async function initiateVote(
  sessionId: number,
  ownerId: number,
  ownerNome: string,
  requiredUserIds: number[]
): Promise<VoteState> {
  const state: VoteState = {
    sessionId,
    ownerId,
    ownerNome,
    requiredUserIds,
    votes: {},
    startedAt: new Date().toISOString(),
  };
  const redis = getRedis();
  if (redis) {
    await redis.set(key(sessionId), JSON.stringify(state), { EX: VOTE_TTL_SECONDS });
  }
  return state;
}

export async function getActiveVote(sessionId: number): Promise<VoteState | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get(key(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VoteState;
  } catch {
    return null;
  }
}

export async function cancelVote(sessionId: number): Promise<void> {
  const redis = getRedis();
  if (redis) await redis.del(key(sessionId));
}

/**
 * Registra o voto de um userId.
 * Retorna null se não há votação ativa, o estado atualizado caso contrário.
 * Se o retorno tiver `resolved: true`, todos votaram SIM → chamar endSession.
 * Se o retorno tiver `resolved: false` e `cancelled: true`, alguém votou NÃO → cancelar.
 */
export async function castVote(
  sessionId: number,
  userId: number,
  vote: "yes" | "no"
): Promise<(VoteState & { resolved: boolean; cancelled: boolean }) | null> {
  const redis = getRedis();
  if (!redis) return null;

  const state = await getActiveVote(sessionId);
  if (!state) return null;

  // Usuário não é elegível para votar
  if (!state.requiredUserIds.includes(userId)) return null;

  state.votes[userId] = vote;

  if (vote === "no") {
    await redis.del(key(sessionId));
    return { ...state, resolved: false, cancelled: true };
  }

  // Verifica se todos votaram SIM
  const allVoted = state.requiredUserIds.every((uid) => state.votes[uid] === "yes");
  if (allVoted) {
    await redis.del(key(sessionId));
    return { ...state, resolved: true, cancelled: false };
  }

  // Salva estado atualizado
  await redis.set(key(sessionId), JSON.stringify(state), { EX: VOTE_TTL_SECONDS });
  return { ...state, resolved: false, cancelled: false };
}
