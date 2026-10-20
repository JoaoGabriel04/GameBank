"use client";

import { useEffect, useRef } from "react";
import { useMotionPrefs } from "@/lib/motion/prefs";

// Número que conta de `de` até `valor` (moedas, XP, diamantes). Escreve
// direto no DOM a cada quadro, sem renderizar o React. Leitores de tela
// ouvem só o valor final. No nível "desligado", mostra o valor na hora.

type Props = {
  valor: number;
  de?: number;
  duracaoMs?: number;
  /** Atraso antes de começar (ms). */
  atrasoMs?: number;
  prefixo?: string;
  sufixo?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Chamado quando o número mostrado muda (no máximo a cada `tiqueMs`): som de tique. */
  onTique?: () => void;
  tiqueMs?: number;
  onFim?: () => void;
};

const formatar = (n: number) => Math.round(n).toLocaleString("pt-BR");

export default function Contador({
  valor,
  de = 0,
  duracaoMs = 900,
  atrasoMs = 0,
  prefixo = "",
  sufixo = "",
  className,
  style,
  onTique,
  tiqueMs = 90,
  onFim,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const { desligado } = useMotionPrefs();
  // Callbacks em ref: trocar a função não reinicia a contagem.
  const tiqueRef = useRef(onTique);
  const fimRef = useRef(onFim);
  tiqueRef.current = onTique;
  fimRef.current = onFim;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const escrever = (n: number) => { el.textContent = `${prefixo}${formatar(n)}${sufixo}`; };
    if (desligado || duracaoMs <= 0 || valor === de) {
      escrever(valor);
      fimRef.current?.();
      return;
    }
    escrever(de);
    let raf = 0;
    let inicio = 0;
    let ultimoTique = 0;
    let ultimoMostrado = Math.round(de);
    const passo = (agora: number) => {
      if (!inicio) inicio = agora;
      const t = Math.min(1, (agora - inicio) / duracaoMs);
      const suave = 1 - Math.pow(1 - t, 3); // easeOutCubic: desacelera no fim
      const atual = de + (valor - de) * suave;
      const mostrado = Math.round(atual);
      if (mostrado !== ultimoMostrado) {
        ultimoMostrado = mostrado;
        escrever(atual);
        if (agora - ultimoTique >= tiqueMs) {
          ultimoTique = agora;
          tiqueRef.current?.();
        }
      }
      if (t < 1) raf = requestAnimationFrame(passo);
      else {
        escrever(valor);
        fimRef.current?.();
      }
    };
    const atraso = setTimeout(() => { raf = requestAnimationFrame(passo); }, atrasoMs);
    return () => {
      clearTimeout(atraso);
      cancelAnimationFrame(raf);
    };
  }, [valor, de, duracaoMs, atrasoMs, prefixo, sufixo, desligado, tiqueMs]);

  return (
    <span className={className} style={style}>
      <span ref={ref} aria-hidden style={{ fontVariantNumeric: "tabular-nums" }}>
        {`${prefixo}${formatar(de)}${sufixo}`}
      </span>
      <span className="sr-only">{`${prefixo}${formatar(valor)}${sufixo}`}</span>
    </span>
  );
}
