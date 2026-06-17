// Contador de sequência por sessão — independente por jogador/sessão
const seqCounters = new Map<number, number>();

export function nextSeq(sessionId: number): number {
  const current = seqCounters.get(sessionId) ?? -1;
  const next = current + 1;
  seqCounters.set(sessionId, next);
  return next;
}

// Chamar ao entrar em nova sessão ou reconectar
export function resetSeq(sessionId: number) {
  seqCounters.set(sessionId, -1);
}
