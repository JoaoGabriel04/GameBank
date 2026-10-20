"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { formatCurrency } from "@/utils/format";
import { curvaCss } from "@/lib/motion";
import { useMotionPrefs } from "@/lib/motion/prefs";

// Saldo que conta do valor anterior até o novo e solta um "+R$ X" (verde)
// ou "−R$ X" (vermelho) que sobe e some. Escreve direto no DOM (sem
// renderizar o React a cada quadro). Com o saldo oculto, não anima nada:
// a variação também entregaria o valor.

type Props = {
  valor: number;
  oculto?: boolean;
  /** Solta o "+R$ X". Desligue onde o mesmo saldo já aparece maior na tela. */
  flutuante?: boolean;
  className?: string;
};

const DURACAO_MS = 600;

export default function SaldoAnimado({ valor, oculto = false, flutuante = true, className }: Props) {
  const numRef = useRef<HTMLSpanElement>(null);
  const raizRef = useRef<HTMLSpanElement>(null);
  const mostradoRef = useRef(valor);
  const { nivel } = useMotionPrefs();

  // O texto do número é só imperativo: se o React também o renderizasse, a
  // escrita direta separaria o nó de texto dele e ocultar o saldo passaria
  // a atualizar um nó solto (o valor continuaria visível).
  useLayoutEffect(() => {
    const el = numRef.current;
    if (!el) return;
    el.textContent = oculto ? "R$ •••••" : `R$ ${formatCurrency(Math.round(mostradoRef.current))}`;
  }, [oculto]);

  useEffect(() => {
    const el = numRef.current;
    const de = mostradoRef.current;
    if (!el || oculto) {
      mostradoRef.current = valor;
      return;
    }
    if (de === valor) {
      el.textContent = `R$ ${formatCurrency(valor)}`;
      return;
    }
    const escrever = (n: number) => { el.textContent = `R$ ${formatCurrency(Math.round(n))}`; };

    if (nivel === "desligado") {
      escrever(valor);
      mostradoRef.current = valor;
      return;
    }

    // Valor flutuante.
    const raiz = raizRef.current;
    if (raiz && flutuante) {
      const delta = valor - de;
      const f = document.createElement("span");
      f.textContent = `${delta > 0 ? "+" : "−"}R$ ${formatCurrency(Math.abs(delta))}`;
      f.setAttribute("aria-hidden", "true");
      f.style.cssText = `position:absolute;left:100%;top:0;margin-left:8px;white-space:nowrap;pointer-events:none;font-size:0.6em;font-weight:700;color:${delta > 0 ? "#4ade80" : "#f87171"}`;
      raiz.appendChild(f);
      const a = f.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)", offset: 0.15 },
          { opacity: 1, transform: "translateY(-14px)", offset: 0.7 },
          { opacity: 0, transform: "translateY(-22px)" },
        ],
        { duration: 1300, easing: curvaCss.easeOut },
      );
      a.onfinish = () => f.remove();
      setTimeout(() => f.remove(), 2000);
    }

    // Contagem do anterior até o novo.
    let raf = 0;
    const t0 = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - t0) / DURACAO_MS);
      const atual = de + (valor - de) * (1 - Math.pow(1 - t, 3));
      escrever(atual);
      mostradoRef.current = atual;
      if (t < 1) raf = requestAnimationFrame(passo);
      else mostradoRef.current = valor;
    };
    raf = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(raf);
      escrever(valor);
      mostradoRef.current = valor;
    };
  }, [valor, oculto, nivel, flutuante]);

  return (
    <span ref={raizRef} className={className} style={{ position: "relative", display: "inline-block" }}>
      <span ref={numRef} style={{ fontVariantNumeric: "tabular-nums" }} />
    </span>
  );
}
