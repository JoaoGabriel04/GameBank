import type { Propriedade, SessionPropriedade } from "@/types/game"
import { calcularCustoOciosa } from "@/shared/economia-core"
import { OCIOSA_CARENCIA_RODADAS, OCIOSA_REGRA } from "@/constants/economia"

/** Rodadas de antecedência do aviso "começa a cobrar em N rodadas". */
export const OCIOSA_AVISO_RODADAS = 2

export type EstadoOciosa = {
  /** Rodadas sem atividade até agora (rodadaAtual - ultimaAtividadeRodada). */
  ociosas: number
  /** Rodadas até a primeira cobrança; <= 0 significa que já está cobrando. */
  faltam: number
  /** Custo que será cobrado na próxima virada de rodada (0 se ainda em carência). */
  custoProximaRodada: number
}

// Mesma regra do servidor (rodada.service.ts): a cobrança acontece na
// virada para a rodada R quando R - ultimaAtividadeRodada >= carência.
// null = posse fora do escopo (ação, com casas, hipotecada, sem dados).
export function estadoOciosa(
  sp: SessionPropriedade,
  prop: Propriedade,
  rodadaAtual: number,
  mods: { manutencaoMult?: number }
): EstadoOciosa | null {
  if (prop.tipo !== "normal" || sp.casas > 0 || sp.hipotecada) return null
  if (sp.ultimaAtividadeRodada == null) return null
  const ociosas = Math.max(0, rodadaAtual - sp.ultimaAtividadeRodada)
  return {
    ociosas,
    faltam: OCIOSA_CARENCIA_RODADAS - ociosas,
    custoProximaRodada: calcularCustoOciosa(prop, sp.casas, sp.hipotecada, ociosas + 1, mods, OCIOSA_REGRA),
  }
}
