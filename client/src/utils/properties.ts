import { SessionPropriedade, Propriedade, PROPERTY_COLORS } from "@/types/game"

export function getPropData(sp: SessionPropriedade): Propriedade | null {
  return sp.posses?.propriedade ?? null
}

const COLOR_ORDER = PROPERTY_COLORS.reduce<Record<string, number>>(
  (acc, c, i) => { acc[c.value] = i; return acc },
  {}
)

export interface PropItem {
  prop: Propriedade
  sessionProp: SessionPropriedade
}

export interface ColorGroup {
  cor: string
  items: PropItem[]
}

function sortByName(items: PropItem[]): PropItem[] {
  return items.sort((a, b) => a.prop.nome.localeCompare(b.prop.nome, "pt-BR"))
}

export function groupByColor(items: PropItem[]): ColorGroup[] {
  const groups: Record<string, PropItem[]> = {}
  for (const item of items) {
    const cor = item.prop.grupo_cor
    if (!groups[cor]) groups[cor] = []
    groups[cor].push(item)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => (COLOR_ORDER[a] ?? 99) - (COLOR_ORDER[b] ?? 99))
    .map(([cor, list]) => ({ cor, items: sortByName(list) }))
}

export type { Propriedade, SessionPropriedade }
