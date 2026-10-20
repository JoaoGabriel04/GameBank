import type { Variants } from "framer-motion";
import { cascata, curva, distancia, duracao, mola } from "./tokens";

// Variantes do Framer Motion (AnimatePresence: modais, sheets, toasts,
// páginas). As seis primeiras vieram de lib/animations.ts com os mesmos
// valores; as demais são novas.

export const backdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalBox: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: distancia.sm },
  visible: { opacity: 1, scale: 1, y: 0, transition: mola.firme },
  exit: { opacity: 0, scale: 0.95, y: distancia.sm, transition: { duration: duracao.saida } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0, transition: mola.suave },
  exit: { opacity: 0, y: "100%", transition: { duration: duracao.fast } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duracao.micro } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: cascata } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: distancia.md },
  visible: { opacity: 1, y: 0, transition: mola.item },
};

// ── Novas ────────────────────────────────────────────────────────────────

/** Troca de página só com opacidade (abas irmãs). */
export const pageFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duracao.fast, ease: curva.easeOut } },
  exit: { opacity: 0, transition: { duration: duracao.saida, ease: curva.easeIn } },
};

/**
 * Troca de página com deslocamento curto. `custom` = direção: 1 entra pela
 * direita (ir mais fundo), -1 pela esquerda (voltar).
 */
export const pageSlide: Variants = {
  hidden: (dir: number = 1) => ({ opacity: 0, x: dir * distancia.sm }),
  visible: { opacity: 1, x: 0, transition: { duration: duracao.base, ease: curva.easeOut } },
  exit: (dir: number = 1) => ({
    opacity: 0,
    x: -dir * (distancia.sm / 2),
    transition: { duration: duracao.saida, ease: curva.easeIn },
  }),
};

/** Aparece "estalando": selos, badges, contadores. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", damping: 14, stiffness: 260 } },
  exit: { opacity: 0, scale: 0.8, transition: { duration: duracao.fast } },
};

/** Pulso único de atenção (anime para "pulse" a partir de "rest"). */
export const pulse: Variants = {
  rest: { scale: 1 },
  pulse: { scale: [1, 1.06, 1], transition: { duration: duracao.slow, ease: curva.easeInOut } },
};

/** Tremida de erro (anime para "shake" a partir de "rest"). */
export const shake: Variants = {
  rest: { x: 0 },
  shake: { x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.4, ease: "easeOut" } },
};
