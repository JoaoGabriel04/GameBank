export type TrophyRank = "BRONZE" | "PRATA" | "OURO" | "PLATINA" | "DIAMANTE" | "MESTRE";

export interface TierInfo {
  rank: TrophyRank;
  tier: number;
  min: number;
  max: number | null;
}

export const TROPHY_TIERS: TierInfo[] = [
  { rank: "BRONZE",   tier: 1, min: 0,    max: 99   },
  { rank: "BRONZE",   tier: 2, min: 100,  max: 199  },
  { rank: "BRONZE",   tier: 3, min: 200,  max: 299  },
  { rank: "PRATA",    tier: 1, min: 300,  max: 449  },
  { rank: "PRATA",    tier: 2, min: 450,  max: 599  },
  { rank: "PRATA",    tier: 3, min: 600,  max: 749  },
  { rank: "OURO",     tier: 1, min: 750,  max: 999  },
  { rank: "OURO",     tier: 2, min: 1000, max: 1249 },
  { rank: "OURO",     tier: 3, min: 1250, max: 1499 },
  { rank: "PLATINA",  tier: 1, min: 1500, max: 1799 },
  { rank: "PLATINA",  tier: 2, min: 1800, max: 2099 },
  { rank: "PLATINA",  tier: 3, min: 2100, max: 2399 },
  { rank: "PLATINA",  tier: 4, min: 2400, max: 2699 },
  { rank: "DIAMANTE", tier: 1, min: 2700, max: 3049 },
  { rank: "DIAMANTE", tier: 2, min: 3050, max: 3399 },
  { rank: "DIAMANTE", tier: 3, min: 3400, max: 3749 },
  { rank: "DIAMANTE", tier: 4, min: 3750, max: 4099 },
  { rank: "MESTRE",   tier: 1, min: 4100, max: null },
];

export const TROPHY_DELTAS: Record<TrophyRank, Record<number, number>> = {
  BRONZE:   { 1: 30,  2: 20,  3: 10,  4: 0, 5: -10, 6: -20 },
  PRATA:    { 1: 28,  2: 18,  3: 8,   4: 0, 5: -12, 6: -22 },
  OURO:     { 1: 25,  2: 15,  3: 7,   4: 0, 5: -15, 6: -25 },
  PLATINA:  { 1: 22,  2: 13,  3: 6,   4: 0, 5: -16, 6: -26 },
  DIAMANTE: { 1: 20,  2: 11,  3: 5,   4: 0, 5: -20, 6: -32 },
  MESTRE:   { 1: 18,  2: 10,  3: 4,   4: 0, 5: -24, 6: -40 },
};

export function getTierInfo(trophies: number): TierInfo {
  for (let i = TROPHY_TIERS.length - 1; i >= 0; i--) {
    if (trophies >= TROPHY_TIERS[i].min) return TROPHY_TIERS[i];
  }
  return TROPHY_TIERS[0];
}

export function getRankFromTrophies(trophies: number): TrophyRank {
  return getTierInfo(trophies).rank;
}

export function getTrophyAssetName(trophies: number): string {
  const info = getTierInfo(trophies);
  if (info.rank === "MESTRE") return "MESTRE";
  return `${info.rank}_${info.tier}`;
}

export function calcularDeltaTrofeus(
  currentTrophies: number,
  rawPosition: number,
  totalPlayers: number
): number {
  const rank = getRankFromTrophies(currentTrophies);
  const deltas = TROPHY_DELTAS[rank];

  let effectivePosition = rawPosition;
  if (totalPlayers < 6 && rawPosition > 3) {
    const stepsFromLast = totalPlayers - rawPosition;
    effectivePosition = stepsFromLast === 0 ? 6 : 5;
    if (totalPlayers === 4 && rawPosition === 4) effectivePosition = 4;
    if (totalPlayers === 3 && rawPosition === 3) effectivePosition = 4;
    if (totalPlayers === 2 && rawPosition === 2) effectivePosition = 6;
  }

  const delta = deltas[effectivePosition] ?? 0;

  if (currentTrophies + delta < 0) return -currentTrophies;

  return delta;
}
