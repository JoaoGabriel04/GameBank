export const MAX_LEVEL = 100;
export const NEGOTIATION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos
export const MAX_NEG_VALOR = 9_999_999;
export const MAX_VALOR = 9_999_999;

export function xpForLevel(level: number): number {
  return Math.floor(200 * Math.pow(1.04, level - 1));
}

export function getLevelFromXp(totalXp: number): number {
  let level = 1;
  let accumulated = 0;
  while (level < MAX_LEVEL) {
    accumulated += xpForLevel(level);
    if (totalXp < accumulated) return level;
    level++;
  }
  return MAX_LEVEL;
}
