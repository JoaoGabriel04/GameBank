import type { Raridade, RaridadeData } from "@/types/raridade"

export const RARIDADE_CONFIG: Record<Raridade, RaridadeData> = {
  COMUM:    { label: "Comum",    cor: "#9ca3af", fundo: "transparent",                                         delay: 0,    ordem: 0, fragmentosSugeridos: 20 },
  INCOMUM:  { label: "Incomum",  cor: "#22d3ee", fundo: "transparent",                                         delay: 0,    ordem: 1, fragmentosSugeridos: 40 },
  RARO:     { label: "Raro",     cor: "#009B15", fundo: "radial-gradient(ellipse at center, #009B1518 0%, transparent 70%)", delay: 0,    ordem: 2, fragmentosSugeridos: 80 },
  EPICO:    { label: "Épico",    cor: "#A600FF", fundo: "radial-gradient(ellipse at center, #A600FF18 0%, transparent 70%)", delay: 0,    ordem: 3, fragmentosSugeridos: 120 },
  LENDARIO: { label: "Lendário", cor: "#fbbf24", fundo: "radial-gradient(ellipse at center, #fbbf2433 0%, #92400e22 50%, transparent 80%)", delay: 2000, ordem: 4, fragmentosSugeridos: 200 },
}

export const RARIDADES: Record<string, { label: string; cor: string }> = Object.fromEntries(
  Object.entries(RARIDADE_CONFIG).map(([k, v]) => [k, { label: v.label, cor: v.cor }])
)

export const RARIDADE_ORDER: Record<string, number> = Object.fromEntries(
  Object.entries(RARIDADE_CONFIG).map(([k, v]) => [k, v.ordem])
)

export const FRAGMENTOS_SUGERIDOS: Record<string, number> = Object.fromEntries(
  Object.entries(RARIDADE_CONFIG).map(([k, v]) => [k, v.fragmentosSugeridos])
)

export const RARIDADE_FUNDO: Record<string, string> = Object.fromEntries(
  Object.entries(RARIDADE_CONFIG).map(([k, v]) => [k, v.fundo])
)

export const RARIDADE_DELAY: Record<string, number> = Object.fromEntries(
  Object.entries(RARIDADE_CONFIG).map(([k, v]) => [k, v.delay])
)

export function raridadeWeight(raridade: string | null | undefined): number {
  if (!raridade) return 999
  return RARIDADE_ORDER[raridade] ?? 999
}

export function getGlowColor(raridade: string | null | undefined): string {
  if (!raridade) return "#9ca3af"
  return RARIDADES[raridade]?.cor ?? "#9ca3af"
}
