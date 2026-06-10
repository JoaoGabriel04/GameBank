export const RARIDADES: Record<string, { label: string; cor: string }> = {
  COMUM:    { label: "Comum",    cor: "#9ca3af" },
  INCOMUM:  { label: "Incomum",  cor: "#22d3ee" },
  RARO:     { label: "Raro",     cor: "#009B15" },
  EPICO:    { label: "Épico",    cor: "#A600FF" },
  LENDARIO: { label: "Lendário", cor: "#fbbf24" },
}

export const RARIDADE_ORDER: Record<string, number> = {
  COMUM: 0,
  INCOMUM: 1,
  RARO: 2,
  EPICO: 3,
  LENDARIO: 4,
}

export const FRAGMENTOS_SUGERIDOS: Record<string, number> = {
  COMUM: 20,
  INCOMUM: 40,
  RARO: 80,
  EPICO: 120,
  LENDARIO: 200,
};

export function raridadeWeight(raridade: string | null | undefined): number {
  if (!raridade) return 999
  return RARIDADE_ORDER[raridade] ?? 999
}

export function getGlowColor(raridade: string | null | undefined): string {
  if (!raridade) return "#9ca3af"
  return RARIDADES[raridade]?.cor ?? "#9ca3af"
}
