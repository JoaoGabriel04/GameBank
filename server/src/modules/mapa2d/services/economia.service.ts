import type { TipoConstrucao } from "../../../../generated/prisma/index.js";
import { mapa2dRepository } from "../mapa2d.repository.js";
import {
  ALUGUEL_GANHO_POR_NIVEL,
  CUSTO_POR_SLOT,
  FAIXAS_IMPOSTO,
  IPTU_PCT,
  MULT_CONSTRUCAO,
  OCUPACAO_LIMIAR_INFERIOR,
  OCUPACAO_PROB_MINIMA,
  REPUTACAO_AJUSTE_OCUPACAO_POR_PONTO,
  RENDA_BASE_REF,
  SLOTS_CONSTRUCAO,
  manutencaoGanhoPorNivel,
  sensibilidadeRegiao,
} from "../../../constants/economiaMapa2D.js";

class EconomiaMapa2DService {
  /** Ativos do jogador (saldo + terrenos + construções, valorados a custo) — usado na checagem de falência. */
  async calcularAtivos(sessionId: number, playerId: number): Promise<number> {
    const player = await mapa2dRepository.findPlayer(playerId);
    if (!player) return 0;

    const terrenos = await mapa2dRepository.findSessionTerrenosComDono(sessionId, playerId);

    let ativos = player.saldo;
    for (const st of terrenos) {
      ativos += st.precoPago ?? 0;
      if (st.construcao) {
        ativos += SLOTS_CONSTRUCAO[st.construcao.tipo] * CUSTO_POR_SLOT;
      }
    }
    return ativos;
  }

  /** Patrimônio líquido (ativos − dívidas em aberto) — usado no ranking de fim de partida. */
  async calcularPatrimonioLiquido(sessionId: number, playerId: number): Promise<number> {
    const ativos = await this.calcularAtivos(sessionId, playerId);
    const debt = await mapa2dRepository.findDebtAberta(sessionId, playerId);
    return ativos - (debt?.valor ?? 0);
  }

  /** Aluguel recomendado no nível 1 — mercado e inflação vêm do evento ativo da sessão (Fatia 2). */
  calcularAluguelRecomendado(
    multiplicadorRegiao: number,
    tipo: TipoConstrucao,
    mercadoMult: number,
    inflacaoAcumulada: number
  ): number {
    const base = RENDA_BASE_REF * multiplicadorRegiao;
    const fatorInflacao = 1 + inflacaoAcumulada;
    return Math.round(base * MULT_CONSTRUCAO[tipo] * mercadoMult * fatorInflacao);
  }

  /** Aplica o ganho de +55%/nível (composto) sobre um valor de referência de nível 1. */
  aluguelNoNivel(baseNivel1: number, nivel: number): number {
    let v = baseNivel1;
    for (let n = 1; n < nivel; n++) v = Math.round(v * (1 + ALUGUEL_GANHO_POR_NIVEL));
    return v;
  }

  /** Manutenção cresce mais rápido por nível quanto mais rica a região (GDD Seção 4). */
  manutencaoNoNivel(baseNivel1: number, nivel: number, multiplicadorRegiao: number): number {
    const ganho = manutencaoGanhoPorNivel(multiplicadorRegiao);
    let v = baseNivel1;
    for (let n = 1; n < nivel; n++) v = Math.round(v * (1 + ganho));
    return v;
  }

  /** Curva de ocupação validada por simulação (GDD Seção 5) — Reputação ajusta a sensibilidade (Fatia 2). */
  calcularOcupacao(
    aluguelPedido: number,
    recomendado: number,
    categoria: "comum" | "mediana" | "rica",
    reputacaoDono: number
  ): boolean {
    if (recomendado <= 0) return false;
    const sensBase = sensibilidadeRegiao(categoria);
    // Reputação 3.0 = neutro (sem ajuste). Cada ponto acima/abaixo ajusta a tolerância de preço.
    const ajusteReputacao = (reputacaoDono - 3.0) * REPUTACAO_AJUSTE_OCUPACAO_POR_PONTO;
    const sens = Math.max(0.05, sensBase + ajusteReputacao);
    const razao = aluguelPedido / recomendado;

    let prob: number;
    if (razao <= OCUPACAO_LIMIAR_INFERIOR) {
      prob = 1.0;
    } else if (razao >= 1 + sens) {
      prob = OCUPACAO_PROB_MINIMA;
    } else {
      prob = Math.max(
        OCUPACAO_PROB_MINIMA,
        1 - ((razao - OCUPACAO_LIMIAR_INFERIOR) / (1 + sens - OCUPACAO_LIMIAR_INFERIOR)) * (1 - OCUPACAO_PROB_MINIMA)
      );
    }
    return Math.random() < prob;
  }

  /** Imposto progressivo por faixas (como IR) sobre o patrimônio total. */
  calcularImpostoProgressivo(patrimonio: number): number {
    let imposto = 0;
    for (const faixa of FAIXAS_IMPOSTO) {
      if (patrimonio <= faixa.min) break;
      const teto = Math.min(patrimonio, faixa.max);
      imposto += (teto - faixa.min) * faixa.aliquota;
    }
    return Math.round(imposto);
  }

  calcularIptu(precoTerreno: number): number {
    return Math.round(precoTerreno * IPTU_PCT);
  }
}

export const economiaMapa2DService = new EconomiaMapa2DService();
