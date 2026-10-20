import type { CSSProperties } from "react";
import { RARIDADE_CONFIG } from "@/constants/raridade";
import type { Raridade } from "@/types/raridade";
import type { NivelEfeitos } from "./tokens";

// Vocabulário visual único por raridade: baú, banners e títulos falam a
// mesma língua. A cor base vem de constants/raridade.ts (fonte única); aqui
// ficam só os parâmetros de efeito.

export type EfeitoRaridade = {
  cor: string;
  /** Tom quase branco da mesma cor, para o núcleo de flashes e brilhos. */
  corClara: string;
  /** Partículas no nível "completo" (metade no "reduzido", zero no "desligado"). */
  particulas: number;
  /** Raios de luz no estouro. */
  raios: number;
  /** 0..1: força do tremor, do flash e da onda de choque. */
  intensidade: number;
  /** Duração-base da antecipação antes do estouro (ms). */
  antecipacaoMs: number;
  /** Padrão de vibração do aparelho (só no "completo"). */
  vibrar: number[] | null;
};

const EFEITOS: Record<Raridade, Omit<EfeitoRaridade, "cor">> = {
  COMUM:    { corClara: "#f4f4f5", particulas: 8,  raios: 0,  intensidade: 0.25, antecipacaoMs: 700,  vibrar: null },
  INCOMUM:  { corClara: "#cffafe", particulas: 12, raios: 6,  intensidade: 0.4,  antecipacaoMs: 900,  vibrar: null },
  RARO:     { corClara: "#bbf7d0", particulas: 18, raios: 8,  intensidade: 0.55, antecipacaoMs: 1100, vibrar: [30] },
  EPICO:    { corClara: "#f3d9ff", particulas: 26, raios: 12, intensidade: 0.75, antecipacaoMs: 1400, vibrar: [40, 40, 60] },
  LENDARIO: { corClara: "#fff7d6", particulas: 36, raios: 16, intensidade: 1,    antecipacaoMs: 1900, vibrar: [60, 50, 60, 50, 140] },
};

function ehRaridade(r: string | null | undefined): r is Raridade {
  return !!r && r in EFEITOS;
}

/** Efeito da raridade ajustado ao nível de efeitos do usuário. */
export function efeitoRaridade(raridade: string | null | undefined, nivel: NivelEfeitos = "completo"): EfeitoRaridade {
  const chave: Raridade = ehRaridade(raridade) ? raridade : "COMUM";
  const base = { cor: RARIDADE_CONFIG[chave].cor, ...EFEITOS[chave] };
  if (nivel === "completo") return base;
  if (nivel === "reduzido") {
    return {
      ...base,
      particulas: Math.floor(base.particulas / 2),
      raios: Math.floor(base.raios / 2),
      intensidade: base.intensidade / 2,
      antecipacaoMs: Math.round(base.antecipacaoMs / 2),
      vibrar: null,
    };
  }
  return { ...base, particulas: 0, raios: 0, intensidade: 0, antecipacaoMs: 0, vibrar: null };
}

/** A raridade mais alta de uma lista (COMUM se vazia). */
export function melhorRaridade(raridades: (string | null | undefined)[]): Raridade {
  let melhor: Raridade = "COMUM";
  for (const r of raridades) {
    if (ehRaridade(r) && RARIDADE_CONFIG[r].ordem > RARIDADE_CONFIG[melhor].ordem) melhor = r;
  }
  return melhor;
}

// ── Estilos de título (vieram de lib/animations.ts, mesmos valores) ──────

export const shimmerTitleStyle: CSSProperties = {
  background: "linear-gradient(90deg, #a78bfa 0%, #ffffff 25%, #fbbf24 50%, #ffffff 75%, #a78bfa 100%)",
  backgroundSize: "200% auto",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
  animation: "gb-shimmer 3s linear infinite",
  display: "inline-block",
};

export const legendaryTitleStyle: CSSProperties = {
  background: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 15%, #fde68a 30%, #fbbf24 50%, #f59e0b 65%, #fde68a 80%, #fbbf24 100%)",
  backgroundSize: "200% auto",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
  animation: "gb-legendary-shimmer 4s ease-in-out infinite",
  display: "inline-block",
  textShadow: "0 0 20px rgba(251,191,36,0.3), 0 0 40px rgba(245,158,11,0.15)",
};
