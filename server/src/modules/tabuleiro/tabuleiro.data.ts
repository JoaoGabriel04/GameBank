import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type CasaTipo =
  | "inicio" | "propriedade" | "acao" | "noticias"
  | "prisao_visita" | "restituicao" | "imposto"
  | "feriado" | "va_para_prisao"

export type Casa = {
  pos: number
  nome: string
  tipo: CasaTipo
  propId?: number
  valor?: number
}

export const TOTAL_CASAS = 40
export const POS_INICIO = 0
export const POS_PRISAO = 10
export const POS_VA_PARA_PRISAO = 30
export const CREDITO_INICIO = 2000
export const MULTA_PRISAO = 500

let tabuleiroCache: Casa[] | null = null

export function getTabuleiro(): Casa[] {
  if (tabuleiroCache) return tabuleiroCache
  const raw = readFileSync(
    resolve(process.cwd(), "data/tabuleiro.json"),
    "utf-8"
  )
  tabuleiroCache = JSON.parse(raw)
  return tabuleiroCache!
}

export function getCasa(pos: number): Casa {
  return getTabuleiro()[pos % TOTAL_CASAS]
}
