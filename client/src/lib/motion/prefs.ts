"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NivelEfeitos } from "./tokens";

// Nível de efeitos visuais: a escolha do usuário em Configurações vence;
// em "automático", o app cai para "reduzido" se o sistema pede menos
// movimento ou se o aparelho parece fraco. A escolha fica salva só neste
// aparelho (o nível certo depende do aparelho), como o volume dos sons.

export type PreferenciaEfeitos = "auto" | NivelEfeitos;
export type MotivoNivel = "escolha" | "sistema" | "aparelho" | "padrao";

interface EfeitosStore {
  preferencia: PreferenciaEfeitos;
  setPreferencia: (p: PreferenciaEfeitos) => void;
}

export const useEfeitosStore = create<EfeitosStore>()(
  persist(
    (set) => ({
      preferencia: "auto",
      setPreferencia: (preferencia) => set({ preferencia }),
    }),
    { name: "gamebank-efeitos" }
  )
);

const CONSULTA_REDUZIR = "(prefers-reduced-motion: reduce)";

function sistemaReduz() {
  return typeof window !== "undefined" && window.matchMedia(CONSULTA_REDUZIR).matches;
}

/** Poucos núcleos, pouca memória ou economia de dados ligada. */
export function aparelhoFraco() {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4 || !!n.connection?.saveData;
}

export function resolverNivel(
  preferencia: PreferenciaEfeitos,
  reduzSistema: boolean,
  fraco: boolean
): { nivel: NivelEfeitos; motivo: MotivoNivel } {
  if (preferencia !== "auto") return { nivel: preferencia, motivo: "escolha" };
  if (reduzSistema) return { nivel: "reduzido", motivo: "sistema" };
  if (fraco) return { nivel: "reduzido", motivo: "aparelho" };
  return { nivel: "completo", motivo: "padrao" };
}

/** Nível atual fora do React (timelines, utilitários). */
export function nivelEfeitosAtual(): NivelEfeitos {
  return resolverNivel(useEfeitosStore.getState().preferencia, sistemaReduz(), aparelhoFraco()).nivel;
}

function assinarSistema(avisar: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(CONSULTA_REDUZIR);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}
const semAssinatura = () => () => {};

/**
 * Preferências de movimento resolvidas. No servidor (e na hidratação) vale
 * "completo"; o valor real chega logo após montar.
 */
export function useMotionPrefs() {
  const preferencia = useEfeitosStore((s) => s.preferencia);
  const reduzSistema = useSyncExternalStore(assinarSistema, sistemaReduz, () => false);
  const fraco = useSyncExternalStore(semAssinatura, aparelhoFraco, () => false);
  const { nivel, motivo } = resolverNivel(preferencia, reduzSistema, fraco);
  return {
    nivel,
    motivo,
    preferencia,
    /** Qualquer coisa abaixo de "completo": sem movimento decorativo. */
    reduced: nivel !== "completo",
    desligado: nivel === "desligado",
  };
}

/** Escala uma quantidade de partículas/elementos pelo nível. */
export function porNivel(qtd: number, nivel: NivelEfeitos) {
  if (nivel === "completo") return qtd;
  if (nivel === "reduzido") return Math.floor(qtd / 2);
  return 0;
}
