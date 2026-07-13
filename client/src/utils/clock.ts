// FIX_TURNO_TRAVADO_CONTADOR (BUG B): os countdowns de turno comparavam
// `turnoIniciadoEm` (hora do SERVIDOR) com `Date.now()` (hora do CLIENTE).
// Se o relógio do jogador estiver adiantado, o cálculo trava em 0 — e como
// o problema é do relógio do cliente, nem o F5 resolve. `serverNow()` usa
// o offset calculado uma vez a partir do timestamp que o servidor manda,
// e deve ser usado em TODO cálculo de tempo relativo a `turnoIniciadoEm`.

let serverOffsetMs = 0;

/** Diferença entre o relógio do servidor e o do cliente. */
export function setServerTime(serverIso: string) {
  serverOffsetMs = new Date(serverIso).getTime() - Date.now();
}

/** "Agora" na régua do servidor — use SEMPRE isto em cálculos de turno. */
export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}
