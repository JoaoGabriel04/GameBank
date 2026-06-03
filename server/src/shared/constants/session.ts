export const MIN_PLAYERS_TO_START_PROD = 3;
export const MIN_PLAYERS_TO_START_DEV = 1;

export function getMinPlayersToStart(): number {
  return process.env.NODE_ENV === "production"
    ? MIN_PLAYERS_TO_START_PROD
    : MIN_PLAYERS_TO_START_DEV;
}
