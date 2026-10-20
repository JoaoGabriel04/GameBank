// ── Utilitários GSAP: agora vivem em lib/motion/gsap ─────────────────────
export { animateStaggerIn, animateGradientLoop, animateProgressBar } from "./motion/gsap";

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
