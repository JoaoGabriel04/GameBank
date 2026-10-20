import { gsap } from "gsap";

// ── GSAP utilities ────────────────────────────────────────────────────────────

export function animateStaggerIn(
  els: NodeListOf<Element> | Element[],
  delay = 0
) {
  if (!els.length) return;
  gsap.killTweensOf(els);
  return gsap.fromTo(
    els,
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", stagger: 0.04, delay }
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
  return gsap.fromTo(
    el,
    { width: "0%" },
    { width: `${pct}%`, duration: 0.8, ease: "power2.out", delay }
  );
}

// ── Variantes e estilos: agora vivem em lib/motion ────────────────────────
// Reexportados aqui para os imports existentes continuarem funcionando.
// Código novo deve importar de "@/lib/motion".

export {
  backdrop,
  modalBox,
  slideUp,
  fadeIn,
  staggerContainer,
  staggerItem,
} from "./motion/variants";
export { shimmerTitleStyle, legendaryTitleStyle } from "./motion/raridade";
