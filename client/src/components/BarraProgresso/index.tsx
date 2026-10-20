"use client";

import { useEffect, useRef } from "react";
import { curvaCss, duracaoMs } from "@/lib/motion";

// Barra fina no topo: troca de rota e requisições lentas (o app está vivo,
// importante no plano gratuito do servidor). Avança rápido no começo e cada
// vez mais devagar, sem chegar ao fim sozinha; quando a espera acaba,
// completa e some. Só transform e opacity (Web Animations API).

const AVANCO_MS = 8000;
// Espera antes de completar: uma requisição que começa logo em seguida
// mantém a mesma barra, sem apagar e reacender.
const APAGAR_APOS_MS = 200;

export default function BarraProgresso({ ativa }: { ativa: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const visivelRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (ativa && visivelRef.current) return;
    if (ativa && !visivelRef.current) {
      visivelRef.current = true;
      animRef.current?.cancel();
      animRef.current = el.animate(
        [
          { opacity: 1, transform: "scaleX(0)" },
          { opacity: 1, transform: "scaleX(0.6)", offset: 0.1 },
          { opacity: 1, transform: "scaleX(0.92)" },
        ],
        { duration: AVANCO_MS, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "forwards" }
      );
      return;
    }

    if (!ativa && visivelRef.current) {
      const completar = () => {
        visivelRef.current = false;
        const atual = getComputedStyle(el).transform;
        animRef.current?.cancel();
        animRef.current = el.animate(
          [
            { opacity: 1, transform: atual === "none" ? "scaleX(0)" : atual },
            { opacity: 1, transform: "scaleX(1)", offset: 0.5 },
            { opacity: 0, transform: "scaleX(1)" },
          ],
          { duration: duracaoMs.base + duracaoMs.fast, easing: curvaCss.easeOut, fill: "forwards" }
        );
      };
      // Reativou antes disso: o cleanup cancela e a barra segue a mesma.
      const t = setTimeout(completar, APAGAR_APOS_MS);
      return () => clearTimeout(t);
    }
  }, [ativa]);

  useEffect(() => () => animRef.current?.cancel(), []);

  return (
    <div
      ref={ref}
      aria-hidden
      data-barra-progresso=""
      className="pointer-events-none fixed top-0 left-0 right-0 z-[150] h-[2px] origin-left bg-green-400 opacity-0"
      style={{ boxShadow: "0 0 8px rgba(74,222,128,0.7)" }}
    />
  );
}
