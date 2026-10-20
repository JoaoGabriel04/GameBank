export type ItemResultado = {
  id: number
  name: string
  type: string
  value?: string | null
  imageUrl?: string | null
  raridade: string
  animated?: boolean | null
  fragmentosGanhos: number
  fragmentosAtuais: number
  fragmentosTotal?: number | null
  itemCompleto: boolean
}

export type BauResultado = {
  tipoBau: string
  coinsGanhos: number
  fragmentosTotal: number
  xpBonus?: number
  itens: ItemResultado[]
  // multi-open
  quantidade?: number
  totalCoinsGanhos?: number
  totalXpBonus?: number
  batches?: {
    coinsGanhos: number
    fragmentosTotal: number
    xpBonus?: number
    itens: ItemResultado[]
  }[]
}

export const BAU_IMAGENS: Record<string, string> = {
  comum:    "/images/cofrinho.webp",
  premium:  "/images/cofre-premium.webp",
  lendario: "/images/cofre-lendario.webp",
}

/** Fundo da tela por raridade (entra quando a carta vira). */
export const FUNDO_RARIDADE: Record<string, string | undefined> = {
  LENDARIO: "linear-gradient(-45deg, #2a1500, #5c2d00, #b85a00, #fbbf2433)",
  EPICO: "linear-gradient(to bottom, #09090b, #1f0033)",
  RARO: "linear-gradient(to bottom, #09090b, #0a3b1e)",
  INCOMUM: "linear-gradient(to bottom, #09090b, #082f36)",
}
