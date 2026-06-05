export const RARITY_META: Record<string, { label: string; color: string }> = {
  comum:      { label: "Comum",      color: "#a1a1aa" },
  raro:       { label: "Raro",       color: "#7dd3fc" },
  super_raro: { label: "Super Raro", color: "#c4b5fd" },
  epico:      { label: "Épico",      color: "#a78bfa" },
  lendario:   { label: "Lendário",   color: "#fcd34d" },
};

export const RARITY_LABELS: Record<string, string> = {
  comum:      "Comum",
  raro:       "Raro",
  super_raro: "Super Raro",
  epico:      "Épico",
  lendario:   "Lendário",
};

const RARITY_CLASSES: Record<string, string> = {
  comum:      "bg-zinc-700 text-zinc-200",
  raro:       "bg-blue-700 text-blue-200",
  super_raro: "bg-violet-600 text-violet-200",
  epico:      "bg-purple-700 text-purple-200",
  lendario:   "bg-yellow-700 text-yellow-200",
};

export function getRarityChipClass(rarity: string | null | undefined): string {
  if (!rarity) return "";
  return RARITY_CLASSES[rarity] ?? "";
}

export function getGlowColor(rarity: string | null | undefined): string {
  if (!rarity) return "#a1a1aa";
  return RARITY_META[rarity]?.color ?? "#a1a1aa";
}
