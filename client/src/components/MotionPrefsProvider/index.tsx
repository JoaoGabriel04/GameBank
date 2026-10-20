"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { useMotionPrefs } from "@/lib/motion/prefs";

// Aplica o nível de efeitos ao app inteiro:
// - <html data-efeitos="..."> desliga as animações decorativas em CSS
//   (globals.css);
// - MotionConfig: abaixo de "completo", o Framer Motion troca movimento
//   (transform/layout) por troca imediata, mantendo os fades de opacidade.
//   Modais e sheets continuam abrindo e fechando normalmente.
export default function MotionPrefsProvider({ children }: { children: ReactNode }) {
  const { nivel } = useMotionPrefs();

  useEffect(() => {
    document.documentElement.dataset.efeitos = nivel;
  }, [nivel]);

  return <MotionConfig reducedMotion={nivel === "completo" ? "never" : "always"}>{children}</MotionConfig>;
}
