"use client";

import { useRef, type RefObject } from "react";
import { createTimeline, gsap, useGSAP } from "@/lib/motion/gsap";
import type { EfeitoRaridade, NivelEfeitos } from "@/lib/motion";
import Faiscas, { type FaiscasHandle } from "@/components/Faiscas";
import { playSfx } from "@/utils/sfx";

// O estouro do baú: uma explosão de luz que tenta parecer a de verdade, do
// jeito que o olho a percebe. Camadas, de baixo para cima:
//
//  adaptação    a cena escurece um instante depois do clarão (o olho se
//               ajustando) e volta
//  pós-imagem   a mancha colorida que fica "queimada" na retina e se
//               dissolve devagar
//  raios        feixes na cor da raridade, girando devagar
//  onda         anel de choque com franja cromática (aberração de lente)
//  flare        risco horizontal de luz (flare anamórfico)
//  núcleo       bloom: branco no centro, a cor da raridade nas bordas
//  tela         superexposição: a tela inteira estoura em branco por ~40 ms
//               e decai (curva gb-flash)
//  faíscas      canvas: nascem brancas e esfriam até a cor
//
// Mais tremor de câmera e vibração do aparelho no nível "completo". No
// lendário, flash duplo: um clarão, um silêncio escuro com um batimento, e
// o estouro de verdade com chuva dourada.
//
// onPico dispara no auge do (último) clarão: é quando o conteúdo de baixo
// troca, escondido pela luz. onFim, quando a última camada apaga.

type Props = {
  efeito: EfeitoRaridade;
  nivel: NivelEfeitos;
  /** Flash duplo (lendário). */
  duplo?: boolean;
  /** Elemento que treme no impacto (a cena, não o overlay). */
  alvoTremor?: RefObject<HTMLElement | null>;
  onPico: () => void;
  onFim: () => void;
};

const centro = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

export default function Estouro({ efeito, nivel, duplo = false, alvoTremor, onPico, onFim }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const faiscas = useRef<FaiscasHandle>(null);
  const picoRef = useRef(onPico);
  const fimRef = useRef(onFim);
  picoRef.current = onPico;
  fimRef.current = onFim;

  useGSAP(
    () => {
      const completo = nivel === "completo";
      const I = Math.max(0.35, efeito.intensidade);
      const q = gsap.utils.selector(raiz);
      // Pico e fim sempre acontecem, mesmo se a timeline for interrompida.
      let picou = false;
      const pico = () => { if (!picou) { picou = true; picoRef.current(); } };
      const { tl, dispose } = createTimeline(
        { onComplete: () => { pico(); fimRef.current(); } },
        { limiteMs: duplo ? 4500 : 3500, instantanea: nivel === "desligado" }
      );

      gsap.set(q(".est-centrado"), { xPercent: -50, yPercent: -50 });

      // Um clarão a partir de `t` (força 0..1). `aviso`: o primeiro clarão
      // do lendário, menor, para a escalada até o estouro de verdade.
      const clarao = (t: number, forca: number, aviso = false) => {
        tl.call(() => playSfx("bau-estouro"), [], t);
        // Superexposição: estoura e cai rápido (um flash real não fica
        // cinza na tela); o contraste vem da adaptação logo depois.
        tl.fromTo(q(".est-tela"), { opacity: 0 }, { opacity: Math.min(0.95, (completo ? 0.95 : 0.5) * forca * (aviso ? 0.5 : 1)), duration: 0.38, ease: "gb-flash" }, t);
        tl.fromTo(q(".est-nucleo"), { opacity: 0, scale: 0.3 }, { opacity: 1, duration: aviso ? 0.6 : 1.0, ease: "gb-flash" }, t);
        tl.to(q(".est-nucleo"), { scale: aviso ? 0.75 : 1.2 + 0.6 * forca, duration: aviso ? 0.6 : 1.0, ease: "power3.out" }, t);
        tl.fromTo(q(".est-flare"), { opacity: 0, scaleX: 0.2 }, { opacity: 0.9 * forca, duration: 0.7, ease: "gb-flash" }, t);
        tl.to(q(".est-flare"), { scaleX: aviso ? 0.6 : 1.15, duration: 0.7, ease: "power3.out" }, t);
        tl.fromTo(q(".est-onda-1"), { opacity: 1, scale: 0.1 }, { opacity: 0, scale: aviso ? 3 : 5 + 4 * forca, duration: 0.8, ease: "power2.out" }, t + 0.02);
        if (!aviso) {
          tl.fromTo(q(".est-onda-2"), { opacity: 0.7, scale: 0.1 }, { opacity: 0, scale: 7 + 5 * forca, duration: 1.0, ease: "power2.out" }, t + 0.1);
        }
        // O olho se ajusta: escurece logo depois do clarão e volta.
        tl.fromTo(q(".est-adaptacao"), { opacity: 0 }, { opacity: 0.45 * forca, duration: 0.18, ease: "power1.out" }, t + 0.22);
        tl.to(q(".est-adaptacao"), { opacity: 0, duration: 0.8, ease: "power2.inOut" }, t + 0.4);
        tl.call(() => {
          const { x, y } = centro();
          faiscas.current?.explodir({ x, y, cor: efeito.cor, qtd: efeito.particulas * (aviso ? 1 : 4), forca: aviso ? 550 : 900 + 700 * forca, tamanho: 2.6 });
          if (!aviso) faiscas.current?.explodir({ x, y, cor: efeito.corClara, qtd: efeito.particulas * 2, forca: 520, tamanho: 1.6, vida: [0.25, 0.6] });
          if (completo && alvoTremor?.current) {
            gsap.fromTo(alvoTremor.current, { x: 0, y: 0 }, {
              x: 6 + 10 * forca, y: 4 + 6 * forca, duration: 0.5, ease: "gb-shake",
              clearProps: "transform",
            });
          }
          if (completo && efeito.vibrar) navigator.vibrate?.(efeito.vibrar);
        }, [], t + 0.02);
      };

      let picoT = 0;
      if (duplo) {
        // 1º clarão, mais fraco; silêncio escuro com dois batimentos; estouro.
        clarao(0, I * 0.6, true);
        tl.to(q(".est-adaptacao"), { opacity: 0.8, duration: 0.25, ease: "power2.out" }, 0.35);
        tl.fromTo(q(".est-nucleo"), { opacity: 0, scale: 0.25 }, { opacity: 0.35, scale: 0.35, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut" }, 0.62);
        tl.fromTo(q(".est-nucleo"), { opacity: 0, scale: 0.25 }, { opacity: 0.5, scale: 0.42, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut" }, 0.92);
        picoT = 1.25;
        clarao(picoT, I);
        // Chuva dourada: faíscas lentas e pesadas depois do estouro.
        tl.call(() => {
          const { x, y } = centro();
          faiscas.current?.explodir({ x, y, cor: efeito.cor, qtd: efeito.particulas * 3, forca: 650, gravidade: 900, tamanho: 3.2, vida: [1.1, 2.0] });
        }, [], picoT + 0.25);
      } else {
        clarao(0, I);
      }
      tl.call(pico, [], picoT + 0.045);

      // Raios na cor da raridade: duas camadas girando em sentidos opostos
      // (larguras e contagens diferentes), para não parecer um leque. Somem
      // antes de cobrir a tela de baixo.
      if (efeito.raios > 0) {
        tl.fromTo(q(".est-raios"), { opacity: 0, scale: 0.6, rotation: 0 }, { opacity: 0.75 * I, scale: 1.15, duration: 0.25, ease: "power2.out" }, picoT + 0.03);
        tl.fromTo(q(".est-raios-2"), { opacity: 0, scale: 0.7, rotation: 8 }, { opacity: 0.45 * I, scale: 1.25, duration: 0.3, ease: "power2.out" }, picoT + 0.05);
        tl.to(q(".est-raios"), { rotation: 26, duration: duplo ? 2.2 : 1.6, ease: "none" }, picoT + 0.03);
        tl.to(q(".est-raios-2"), { rotation: -18, duration: duplo ? 2.2 : 1.6, ease: "none" }, picoT + 0.05);
        tl.to(q(".est-raios, .est-raios-2"), { opacity: 0, duration: duplo ? 1.0 : 0.8, ease: "power2.in" }, picoT + (duplo ? 0.7 : 0.45));
      }

      // Pós-imagem: a mancha que fica na retina e se dissolve devagar.
      tl.fromTo(q(".est-posimagem"), { opacity: 0, scale: 0.85 }, { opacity: 0.55 * I, scale: 1.05, duration: 0.35, ease: "power1.out" }, picoT + 0.25);
      tl.to(q(".est-posimagem"), { opacity: 0, scale: 1.35, duration: 1.4, ease: "power1.inOut" }, picoT + 0.6);

      return dispose;
    },
    { scope: raiz }
  );

  const { cor, corClara, raios } = efeito;
  const fatia = raios > 0 ? 360 / raios : 360;

  return (
    <div ref={raiz} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }}>
      <div className="est-adaptacao" style={{ position: "absolute", inset: 0, background: "#000", opacity: 0 }} />

      <div
        className="est-posimagem est-centrado gb-luz"
        style={{
          position: "absolute", left: "50%", top: "50%", width: "120vmax", height: "120vmax", opacity: 0, borderRadius: "50%",
          background: `radial-gradient(circle, ${cor}aa 0%, ${cor}55 18%, ${cor}22 34%, transparent 55%)`,
        }}
      />

      {raios > 0 && (
        <div
          className="est-raios est-centrado gb-luz"
          style={{
            position: "absolute", left: "50%", top: "50%", width: "160vmax", height: "160vmax", opacity: 0, borderRadius: "50%",
            background: `repeating-conic-gradient(from 0deg, ${corClara}cc 0deg, ${cor}66 ${fatia * 0.08}deg, transparent ${fatia * 0.22}deg, transparent ${fatia}deg)`,
            WebkitMaskImage: "radial-gradient(circle, #000 4%, rgba(0,0,0,0.6) 22%, transparent 50%)",
            maskImage: "radial-gradient(circle, #000 4%, rgba(0,0,0,0.6) 22%, transparent 50%)",
          }}
        />
      )}

      {raios > 0 && (
        <div
          className="est-raios-2 est-centrado gb-luz"
          style={{
            position: "absolute", left: "50%", top: "50%", width: "170vmax", height: "170vmax", opacity: 0, borderRadius: "50%",
            background: `repeating-conic-gradient(from ${fatia / 3}deg, ${corClara}99 0deg, transparent ${fatia * 0.06}deg, transparent ${fatia * 0.67}deg)`,
            WebkitMaskImage: "radial-gradient(circle, #000 3%, rgba(0,0,0,0.45) 18%, transparent 42%)",
            maskImage: "radial-gradient(circle, #000 3%, rgba(0,0,0,0.45) 18%, transparent 42%)",
          }}
        />
      )}

      {[1, 2].map((n) => (
        <div
          key={n}
          className={`est-onda-${n} est-centrado`}
          style={{
            position: "absolute", left: "50%", top: "50%", width: 140, height: 140, borderRadius: "50%", opacity: 0,
            border: `${n === 1 ? 3 : 1.5}px solid ${corClara}`,
            // Franja cromática: vermelho e ciano deslocados, como lente.
            boxShadow: `-3px 0 0 -1px rgba(255,70,90,0.55), 3px 0 0 -1px rgba(70,210,255,0.55), 0 0 24px ${cor}88, inset 0 0 18px ${cor}66`,
          }}
        />
      ))}

      <div
        className="est-flare est-centrado gb-luz"
        style={{
          position: "absolute", left: "50%", top: "50%", width: "130vw", height: 10, opacity: 0, borderRadius: "50%",
          background: `radial-gradient(ellipse at center, #ffffff 0%, ${corClara} 25%, ${cor}66 55%, transparent 75%)`,
          filter: "blur(1.5px)",
        }}
      />

      <div
        className="est-nucleo est-centrado gb-luz"
        style={{
          position: "absolute", left: "50%", top: "50%", width: "90vmax", height: "90vmax", opacity: 0, borderRadius: "50%",
          background: `radial-gradient(circle, #ffffff 0%, #ffffff 9%, ${corClara} 20%, ${cor}aa 34%, ${cor}33 50%, transparent 66%)`,
        }}
      />

      <div className="est-tela" style={{ position: "absolute", inset: 0, background: "#ffffff", opacity: 0 }} />

      <Faiscas ref={faiscas} />
    </div>
  );
}
