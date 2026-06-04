export const RARITY_LABELS: Record<string, string> = {
  common: "Comum",
  rare: "Raro",
  epic: "Epico",
  legendary: "Lendario",
};

export const RARITY_CHIP_CLASSES: Record<string, string> = {
  common: "bg-zinc-700 text-zinc-200",
  rare: "bg-blue-700 text-blue-200",
  epic: "bg-purple-700 text-purple-200",
  legendary: "bg-yellow-700 text-yellow-200",
};

export function getRarityChipClass(rarity: string | null | undefined): string {
  if (!rarity) return "";
  return RARITY_CHIP_CLASSES[rarity] ?? RARITY_CHIP_CLASSES.common;
}
