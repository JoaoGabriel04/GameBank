"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Faíscas em canvas (estouro do baú, revelação de raridade, moedas).
// Imperativo: explodir() não renderiza o React; o loop de desenho só roda
// enquanto há faísca viva e para sozinho. Mistura aditiva ("lighter"):
// faíscas sobrepostas somam luz, como brilho de verdade.
//
// Cada faísca nasce branca (quente) e esfria até a cor pedida, deixa rastro
// (linha da posição anterior até a atual), sofre arrasto do ar e gravidade.

export type Explosao = {
  /** Centro em px da janela. */
  x: number;
  y: number;
  /** Cor final (fria) e quantidade. */
  cor: string;
  qtd: number;
  /** Velocidade inicial máxima (px/s). */
  forca?: number;
  /** px/s² para baixo. */
  gravidade?: number;
  /** Espessura base do rastro (px). */
  tamanho?: number;
  /** Vida em segundos: [mínima, máxima]. */
  vida?: [number, number];
};

export type FaiscasHandle = { explodir: (e: Explosao) => void };

type Faisca = {
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  vida: number; idade: number;
  tamanho: number;
  rgb: [number, number, number];
  gravidade: number;
};

const MAX_FAISCAS = 420;
const ARRASTO = 2.2; // por segundo

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const Faiscas = forwardRef<FaiscasHandle>(function Faiscas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faiscasRef = useRef<Faisca[]>([]);
  const rafRef = useRef<number | null>(null);
  const ultimoRef = useRef(0);

  // Ajusta o canvas à janela (com devicePixelRatio, máx. 2).
  useEffect(() => {
    const ajustar = () => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(window.innerWidth * dpr);
      c.height = Math.round(window.innerHeight * dpr);
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => {
      window.removeEventListener("resize", ajustar);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const quadro = (agora: number) => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dt = Math.min(0.05, (agora - ultimoRef.current) / 1000);
    ultimoRef.current = agora;

    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    const vivas: Faisca[] = [];
    const arrasto = Math.exp(-ARRASTO * dt);
    for (const f of faiscasRef.current) {
      f.idade += dt;
      if (f.idade >= f.vida) continue;
      f.px = f.x;
      f.py = f.y;
      f.vx *= arrasto;
      f.vy = f.vy * arrasto + f.gravidade * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      const t = f.idade / f.vida; // 0 → 1
      // Quente (branco) no começo, esfria até a cor.
      const calor = Math.max(0, 1 - t * 2.2);
      const r = Math.round(f.rgb[0] + (255 - f.rgb[0]) * calor);
      const g = Math.round(f.rgb[1] + (255 - f.rgb[1]) * calor);
      const b = Math.round(f.rgb[2] + (255 - f.rgb[2]) * calor);
      const alfa = (1 - t) * (1 - t);

      ctx.strokeStyle = `rgba(${r},${g},${b},${alfa})`;
      ctx.lineWidth = f.tamanho * (1 - t * 0.6);
      ctx.beginPath();
      // Rastro: um pouco mais longo que o passo, para a faísca "riscar".
      ctx.moveTo(f.px - (f.x - f.px) * 1.5, f.py - (f.y - f.py) * 1.5);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
      vivas.push(f);
    }
    faiscasRef.current = vivas;
    rafRef.current = vivas.length ? requestAnimationFrame(quadro) : null;
    if (!vivas.length) ctx.clearRect(0, 0, c.width, c.height);
  };

  useImperativeHandle(ref, () => ({
    explodir: ({ x, y, cor, qtd, forca = 900, gravidade = 520, tamanho = 2.4, vida = [0.6, 1.4] }) => {
      if (qtd <= 0) return;
      const rgb = hexParaRgb(cor);
      const novas: Faisca[] = [];
      const n = Math.min(qtd, MAX_FAISCAS - faiscasRef.current.length);
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        // Distribuição puxada para velocidades médias, com algumas rápidas.
        const v = forca * (0.25 + Math.pow(Math.random(), 0.6) * 0.75);
        novas.push({
          x, y, px: x, py: y,
          vx: Math.cos(ang) * v,
          vy: Math.sin(ang) * v - forca * 0.12,
          vida: vida[0] + Math.random() * (vida[1] - vida[0]),
          idade: 0,
          tamanho: tamanho * (0.5 + Math.random()),
          rgb,
          gravidade,
        });
      }
      faiscasRef.current.push(...novas);
      if (rafRef.current == null) {
        ultimoRef.current = performance.now();
        rafRef.current = requestAnimationFrame(quadro);
      }
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
});

export default Faiscas;
