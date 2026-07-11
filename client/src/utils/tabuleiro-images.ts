import type { Casa } from "@/types/game"

// Mapa grupo de cor → imagem. Chaves EXATAS do propriedades.json.
const GRUPO_IMAGEM: Record<string, string> = {
  "Verde-Claro":  "/images/tabuleiro/grupos/verde-claro.webp",
  "Roxo":         "/images/tabuleiro/grupos/roxo.webp",
  "Verde-Escuro": "/images/tabuleiro/grupos/verde-escuro.webp",
  "Azul":         "/images/tabuleiro/grupos/azul.webp",
  "Vermelho":     "/images/tabuleiro/grupos/vermelho.webp",
  "Amarelo":      "/images/tabuleiro/grupos/amarelo.webp",
  "Laranja":      "/images/tabuleiro/grupos/laranja.webp",
  "Rosa":         "/images/tabuleiro/grupos/rosa.webp",
  "Preto":        "/images/tabuleiro/grupos/preto.webp",
}

// Mapa tipo de casa especial → imagem
const CASA_IMAGEM: Partial<Record<Casa["tipo"], string>> = {
  inicio:         "/images/tabuleiro/casas/inicio.webp",
  prisao_visita:  "/images/tabuleiro/casas/prisao.webp",
  va_para_prisao: "/images/tabuleiro/casas/detencao.webp",
  noticias:       "/images/tabuleiro/casas/noticias.webp",
  imposto:        "/images/tabuleiro/casas/receita-federal.webp",
  restituicao:    "/images/tabuleiro/casas/imposto.webp",
  feriado:        "/images/tabuleiro/casas/feriado.webp",
}

export function getGrupoImagem(grupoCor?: string | null): string | null {
  if (!grupoCor) return null
  return GRUPO_IMAGEM[grupoCor] ?? null
}

export function getCasaImagem(tipo: Casa["tipo"]): string | null {
  return CASA_IMAGEM[tipo] ?? null
}

export const ARTE_CENTRAL = "/images/tabuleiro/casas/arte-central.webp"
export const FUNDO_TABULEIRO = "/images/tabuleiro/casas/fundo-tabuleiro.webp"

export const GRUPO_IMAGENS_PRELOAD = Object.values(GRUPO_IMAGEM)
