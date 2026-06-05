const META = (color: string) => ({ color });

export const RARITY_META: Record<string, { label: string; color: string }> = {
  common:     { label: "Comum",      color: "#d4d4d8" },
  rare:       { label: "Raro",       color: "#22c55e" },
  super_rare: { label: "Super Raro", color: "#3b82f6" },
  epic:       { label: "Épico",      color: "#6366f1" },
  legendary:  { label: "Lendário",   color: "#f59e0b" },
  /* aliases pt-br para retrocompatibilidade */
  comum:      { label: "Comum",      color: "#d4d4d8" },
  raro:       { label: "Raro",       color: "#22c55e" },
  super_raro: { label: "Super Raro", color: "#3b82f6" },
  epico:      { label: "Épico",      color: "#6366f1" },
  lendario:   { label: "Lendário",   color: "#f59e0b" },
};

export const RARITY_LABELS: Record<string, string> = {
  common:     "Comum",
  rare:       "Raro",
  super_rare: "Super Raro",
  epic:       "Épico",
  legendary:  "Lendário",
  comum:      "Comum",
  raro:       "Raro",
  super_raro: "Super Raro",
  epico:      "Épico",
  lendario:   "Lendário",
};

const RARITY_CLASSES: Record<string, string> = {
  common:     "bg-zinc-500 text-zinc-100",
  rare:       "bg-green-600 text-green-100",
  super_rare: "bg-blue-600 text-blue-100",
  epic:       "bg-indigo-600 text-indigo-100",
  legendary:  "bg-amber-600 text-amber-100",
  comum:      "bg-zinc-500 text-zinc-100",
  raro:       "bg-green-600 text-green-100",
  super_raro: "bg-blue-600 text-blue-100",
  epico:      "bg-indigo-600 text-indigo-100",
  lendario:   "bg-amber-600 text-amber-100",
};

export function getRarityChipClass(rarity: string | null | undefined): string {
  if (!rarity) return "";
  return RARITY_CLASSES[rarity] ?? "";
}

export function getGlowColor(rarity: string | null | undefined): string {
  if (!rarity) return "#d4d4d8";
  return RARITY_META[rarity]?.color ?? "#d4d4d8";
}
