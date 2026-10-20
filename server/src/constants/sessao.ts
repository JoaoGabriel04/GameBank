// Sala "Em Andamento" sem nenhum jogador conectado por este tempo é
// encerrada sem recompensas (session/abandono.service.ts). Os timers de
// turno jogam pelos ausentes, então sem isso a sala roda para sempre.
export const SALA_ABANDONADA_MS = 15 * 60_000;
