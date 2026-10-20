"use client";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { CustomEase } from "gsap/CustomEase";
import { CustomWiggle } from "gsap/CustomWiggle";

// Ponto único de registro do GSAP (padrão do SkillHub, lib/gsap.ts): todo
// componente que precisa de plugin ou curva própria importa daqui. Só no
// navegador: no SSR os plugins não registram.
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, CustomEase, CustomWiggle);

  // Tremida de erro / impacto curto.
  CustomWiggle.create("gb-shake", { wiggles: 7, type: "easeOut" });
  // Tremor que cresce até o fim (antecipação do baú).
  CustomWiggle.create("gb-tremor", { wiggles: 14, type: "easeInOut" });
  // Sobe rápido e passa um pouco do ponto antes de assentar.
  CustomEase.create("gb-pop", "M0,0 C0.2,0 0.25,1.25 0.55,1.12 0.75,1.04 0.85,1 1,1");
  // Pulso de luz: ataque quase instantâneo e decaimento longo, voltando a 0.
  // Use num tween de 0 → pico: a curva já faz a volta.
  CustomEase.create("gb-flash", "M0,0 C0.02,0.6 0.04,1 0.08,1 0.3,1 0.42,0.28 1,0");
}

/** O sistema pede menos movimento (não considera a configuração do app). */
export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type OpcoesTimeline = {
  /**
   * Rede de segurança: se a timeline não terminar em `limiteMs` (aba em
   * segundo plano, elemento desmontado, erro no meio), ela é levada ao fim,
   * disparando os callbacks pendentes. Nenhuma tela pode depender só do
   * onComplete para destravar.
   */
  limiteMs?: number;
  /** Termina na hora (nível "desligado"): callbacks rodam, nada anima. */
  instantanea?: boolean;
};

/**
 * Cria uma timeline e devolve `dispose`, que cancela o limite de segurança e
 * mata a timeline. Chame `dispose` no cleanup do efeito.
 *
 *   const { tl, dispose } = createTimeline({ onComplete: avancar }, { limiteMs: 3000 })
 *   tl.to(...)
 *   return dispose
 */
export function createTimeline(vars: gsap.TimelineVars = {}, { limiteMs, instantanea = false }: OpcoesTimeline = {}) {
  const tl = gsap.timeline(vars);
  let limite: ReturnType<typeof setTimeout> | null = null;
  let descartada = false;

  const concluir = () => {
    if (!descartada && tl.progress() < 1) tl.progress(1, false);
  };
  if (instantanea) {
    // Depois que quem chamou montar a timeline (mesmo tick).
    queueMicrotask(concluir);
  } else if (limiteMs != null) {
    limite = setTimeout(concluir, limiteMs);
    // O GSAP guarda o próprio `vars` e o eventCallback grava nele: pegar o
    // callback original antes, senão o wrapper chama a si mesmo.
    const original = vars.onComplete;
    tl.eventCallback("onComplete", () => {
      if (limite) clearTimeout(limite);
      original?.call(tl);
    });
  }

  const dispose = () => {
    descartada = true;
    if (limite) clearTimeout(limite);
    tl.kill();
  };
  return { tl, dispose };
}

export { animateStaggerIn, animateGradientLoop, animateProgressBar } from "./utilitarios";
export { gsap, useGSAP };
