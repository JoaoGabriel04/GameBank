import { gsap } from "gsap";
import { duracao } from "./tokens";

// Utilitários GSAP sem plugins (vieram de lib/animations.ts, mesmos
// valores). Ficam fora de lib/motion/gsap.ts para não carregar CustomEase e
// CustomWiggle em toda página que só quer uma entrada em cascata.

export function animateStaggerIn(els: NodeListOf<Element> | Element[], delay = 0) {
  if (!els.length) return;
  gsap.killTweensOf(els);
  return gsap.fromTo(
    els,
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: duracao.base, ease: "power2.out", stagger: 0.04, delay }
  );
}

export function animateGradientLoop(el: Element, duration = 3) {
  return gsap.fromTo(
    el,
    { backgroundPosition: "0% 50%" },
    { backgroundPosition: "100% 50%", duration, ease: "none", repeat: -1, yoyo: true }
  );
}

export function animateProgressBar(el: Element, pct: number, delay = 0.2) {
  return gsap.fromTo(el, { width: "0%" }, { width: `${pct}%`, duration: 0.8, ease: "power2.out", delay });
}
