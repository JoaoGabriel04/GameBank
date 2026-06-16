import type { CSSProperties } from "react";
import type { Variants } from "framer-motion";
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

// ── Framer Motion variants (mantidos para AnimatePresence) ────────────────────

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

export const backdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalBox: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", damping: 25, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15 },
  },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: "100%" },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 30, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    y: "100%",
    transition: { duration: 0.2 },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.08 } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 20, stiffness: 200 },
  },
};
