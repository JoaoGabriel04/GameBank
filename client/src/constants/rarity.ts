export const RARITY_META: Record<string, { label: string; color: string }> = {
  comum:      { label: "Comum",      color: "#d4d4d8" },
  raro:       { label: "Raro",       color: "#22c55e" },
  super_raro: { label: "Super Raro", color: "#3b82f6" },
  epico:      { label: "Épico",      color: "#6366f1" },
  lendario:   { label: "Lendário",   color: "#f59e0b" },
  /* aliases en para retrocompatibilidade */
  common:     { label: "Comum",      color: "#d4d4d8" },
  rare:       { label: "Raro",       color: "#22c55e" },
  super_rare: { label: "Super Raro", color: "#3b82f6" },
  epic:       { label: "Épico",      color: "#6366f1" },
  legendary:  { label: "Lendário",   color: "#f59e0b" },
};

export const RARITY_LABELS: Record<string, string> = {
  comum:      "Comum",
  raro:       "Raro",
  super_raro: "Super Raro",
  epico:      "Épico",
  lendario:   "Lendário",
  common:     "Comum",
  rare:       "Raro",
  super_rare: "Super Raro",
  epic:       "Épico",
  legendary:  "Lendário",
};

export function getGlowColor(rarity: string | null | undefined): string {
  if (!rarity) return "#d4d4d8";
  return RARITY_META[rarity]?.color ?? "#d4d4d8";
}
