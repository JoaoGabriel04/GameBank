export const MAX_LEVEL = 100;
export const NEGOTIATION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos
export const MAX_NEG_VALOR = 9_999_999;
export const MAX_VALOR = 9_999_999;

export function xpForLevel(level: number): number {
  return Math.floor(200 * Math.pow(1.17, level - 1));
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

export function totalXpForLevels(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpForLevel(i);
  return total;
}

export function addXp(currentXp: number, currentLevel: number, amount: number): { xp: number; level: number } {
  let xp = currentXp + amount;
  let level = currentLevel;
  while (xp >= xpForLevel(level) && level < MAX_LEVEL) {
    xp -= xpForLevel(level);
    level++;
  }
  return { xp, level };
}

export function subXp(currentXp: number, currentLevel: number, amount: number): { xp: number; level: number } {
  let xp = currentXp - amount;
  let level = currentLevel;
  while (xp < 0 && level > 1) {
    level--;
    xp += xpForLevel(level);
  }
  if (xp < 0) xp = 0;
  return { xp, level };
}
