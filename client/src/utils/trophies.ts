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

export function getTrophyLabel(trophies: number): string {
  const info = getTierInfo(trophies);
  const rankLabel: Record<TrophyRank, string> = {
    BRONZE: "Bronze",
    PRATA: "Prata",
    OURO: "Ouro",
    PLATINA: "Platina",
    DIAMANTE: "Diamante",
    MESTRE: "Mestre",
  };
  if (info.rank === "MESTRE") return "Mestre";
  return `${rankLabel[info.rank]} ${info.tier}`;
}
