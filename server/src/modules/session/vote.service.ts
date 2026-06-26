import { getRedis } from "../../lib/redis.js";

const VOTE_TTL_SECONDS = 120;
const KICK_VOTE_TTL_SECONDS = 60;

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

// ─── Votação de expulsão ────────────────────────────────────────────────────

interface KickVoteState {
  sessionId: number;
  targetPlayerId: number;   // SessionPlayer.id
  targetUserId: number | null;
  targetNome: string;
  initiatorUserId: number;
  initiatorNome: string;
  requiredUserIds: number[]; // userId de cada elegível (ativo, exceto alvo)
  playerNames: Record<number, string>;
  votes: Record<number, "yes" | "no">;
  startedAt: string;
  expiresAt: string;
}

function kickKey(sessionId: number) {
  return `vote:kick:${sessionId}`;
}

export async function initiateKickVote(
  sessionId: number,
  initiatorUserId: number,
  initiatorNome: string,
  targetPlayerId: number,
  targetUserId: number | null,
  targetNome: string,
  requiredUserIds: number[],
  playerNames: Record<number, string>
): Promise<KickVoteState> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + KICK_VOTE_TTL_SECONDS * 1000);
  const state: KickVoteState = {
    sessionId,
    targetPlayerId,
    targetUserId,
    targetNome,
    initiatorUserId,
    initiatorNome,
    requiredUserIds,
    playerNames,
    votes: {},
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  const redis = getRedis();
  if (redis) {
    await redis.set(kickKey(sessionId), JSON.stringify(state), { EX: KICK_VOTE_TTL_SECONDS });
  }
  return state;
}

export async function getActiveKickVote(sessionId: number): Promise<KickVoteState | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get(kickKey(sessionId));
  if (!raw) return null;
  try { return JSON.parse(raw) as KickVoteState; } catch { return null; }
}

export async function cancelKickVote(sessionId: number): Promise<void> {
  const redis = getRedis();
  if (redis) await redis.del(kickKey(sessionId));
}

export async function castKickVote(
  sessionId: number,
  userId: number,
  vote: "yes" | "no"
): Promise<(KickVoteState & { passed: boolean; finished: boolean }) | null> {
  const redis = getRedis();
  if (!redis) return null;

  const state = await getActiveKickVote(sessionId);
  if (!state) return null;
  if (!state.requiredUserIds.includes(userId)) return null;

  state.votes[userId] = vote;

  const eligible = state.requiredUserIds.length;
  const yesCount = state.requiredUserIds.filter((uid) => state.votes[uid] === "yes").length;
  const noCount  = state.requiredUserIds.filter((uid) => state.votes[uid] === "no").length;
  const majority = Math.ceil(eligible / 2);

  // Maioria a favor → expulsão aprovada
  if (yesCount >= majority) {
    await redis.del(kickKey(sessionId));
    return { ...state, passed: true, finished: true };
  }

  // Maioria contra → expulsão reprovada
  if (noCount > eligible - majority) {
    await redis.del(kickKey(sessionId));
    return { ...state, passed: false, finished: true };
  }

  // Ainda aguardando votos
  await redis.set(kickKey(sessionId), JSON.stringify(state), { EX: KICK_VOTE_TTL_SECONDS });
  return { ...state, passed: false, finished: false };
}
