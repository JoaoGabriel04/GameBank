export const RARITY_META: Record<string, { label: string; color: string }> = {
  common:     { label: "Comum",      color: "#22c55e" },
  rare:       { label: "Raro",       color: "#3b82f6" },
  super_rare: { label: "Super Raro", color: "#a78bfa" },
  epic:       { label: "Épico",      color: "#d946ef" },
  legendary:  { label: "Lendário",   color: "#f59e0b" },
};

export const RARITY_LABELS: Record<string, string> = {
  common:     "Comum",
  rare:       "Raro",
  super_rare: "Super Raro",
  epic:       "Épico",
  legendary:  "Lendário",
};

const RARITY_CLASSES: Record<string, string> = {
  common:     "bg-green-700 text-green-200",
  rare:       "bg-blue-700 text-blue-200",
  super_rare: "bg-violet-600 text-violet-200",
  epic:       "bg-fuchsia-600 text-fuchsia-200",
  legendary:  "bg-amber-600 text-amber-200",
};

export function getRarityChipClass(rarity: string | null | undefined): string {
  if (!rarity) return "";
  return RARITY_CLASSES[rarity] ?? "";
}

export function getGlowColor(rarity: string | null | undefined): string {
  if (!rarity) return "#a1a1aa";
  return RARITY_META[rarity]?.color ?? "#a1a1aa";
}
