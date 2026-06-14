import { SessionPropriedade, Propriedade, PROPERTY_COLORS } from "@/types/game"

export function getPropData(sp: SessionPropriedade): Propriedade | null {
  return sp.propriedade ?? null
}

const COLOR_ORDER = PROPERTY_COLORS.reduce<Record<string, number>>(
  (acc, c, i) => { acc[c.value] = i; return acc },
  {}
)

export function sortSessionPosses(items: SessionPropriedade[]): SessionPropriedade[] {
  return [...items].sort((a, b) => {
    const corA = a.propriedade?.grupo_cor ?? ''
    const corB = b.propriedade?.grupo_cor ?? ''
    const orderA = COLOR_ORDER[corA] ?? 99
    const orderB = COLOR_ORDER[corB] ?? 99
    if (orderA !== orderB) return orderA - orderB
    const nomeA = a.propriedade?.nome ?? ''
    const nomeB = b.propriedade?.nome ?? ''
    return nomeA.localeCompare(nomeB, 'pt-BR')
  })
}

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

export function sortPropItems(items: PropItem[]): PropItem[] {
  return [...items].sort((a, b) => {
    const orderA = COLOR_ORDER[a.prop.grupo_cor] ?? 99
    const orderB = COLOR_ORDER[b.prop.grupo_cor] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return a.prop.nome.localeCompare(b.prop.nome, 'pt-BR')
  })
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
