export const RARITY_ORDER: Record<string, number> = {
  comum: 0,
  raro: 1,
  super_raro: 2,
  epico: 3,
  lendario: 4,
  common: 0,
  rare: 1,
  super_rare: 2,
  epic: 3,
  legendary: 4,
};

export function rarityWeight(rarity: string | null | undefined): number {
  if (!rarity) return 999;
  return RARITY_ORDER[rarity] ?? 999;
}
