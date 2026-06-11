export const RARIDADES = {
  COMUM:    { label: "Comum",    cor: "#9ca3af", probabilidade: 0.60 },
  INCOMUM:  { label: "Incomum",  cor: "#22d3ee", probabilidade: 0.25 },
  RARO:     { label: "Raro",     cor: "#009B15", probabilidade: 0.10 },
  EPICO:    { label: "Épico",    cor: "#A600FF", probabilidade: 0.04 },
  LENDARIO: { label: "Lendário", cor: "#fbbf24", probabilidade: 0.01 },
} as const

export type Raridade = keyof typeof RARIDADES

export const RARIDADE_ORDER: Record<Raridade, number> = {
  COMUM: 0,
  INCOMUM: 1,
  RARO: 2,
  EPICO: 3,
  LENDARIO: 4,
}

export function raridadeWeight(raridade: Raridade | null | undefined): number {
  if (!raridade) return 999
  return RARIDADE_ORDER[raridade as Raridade] ?? 999
}

export const FRAGMENTOS_SUGERIDOS: Record<Raridade, number> = {
  COMUM: 20,
  INCOMUM: 40,
  RARO: 80,
  EPICO: 120,
  LENDARIO: 200,
}
