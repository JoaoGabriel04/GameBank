import { SessionPropriedade, Propriedade, PROPERTY_COLORS } from "@/types/game"

export function getPropData(sp: SessionPropriedade): Propriedade | null {
  return sp.propriedade ?? null
}

const COLOR_HEX: Record<string, string> = {
  lime: "#84cc16",
  green: "#15803d",
  red: "#dc2626",
  blue: "#2563eb",
  amber: "#fcd34d",
  orange: "#ea580c",
  pink: "#db2777",
  purple: "#7e22ce",
  zinc: "#fafafa",
}

export function getGroupColorHex(grupoCor: string | null | undefined): string {
  if (!grupoCor) return "#52525b"
  const found = PROPERTY_COLORS.find((c) => c.value === grupoCor)
  if (!found) return COLOR_HEX[grupoCor] ?? "#52525b"
  const match = found.bg?.match(/bg-(\w+)/)
  if (match) return COLOR_HEX[match[1]] ?? "#52525b"
  return "#52525b"
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
