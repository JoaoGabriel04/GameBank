"use client";

import { useMemo, useRef } from "react";
import { createTimeline, gsap, useGSAP } from "@/lib/motion/gsap";
import type { EfeitoRaridade, NivelEfeitos } from "@/lib/motion";
import { playSfx } from "@/utils/sfx";

// Antecipação: o baú treme cada vez mais, a luz vaza pelas frestas, a
// vinheta fecha o resto da tela. No fim, tudo se recolhe por um instante
// (implosão) e onPronto dispara o estouro.
//
// A luz aqui é branca quente, nunca a cor da raridade: a cor só aparece no
// estouro. A duração vem da raridade do melhor item (efeito.antecipacaoMs),
// como o plano prevê.

const N_FRESTAS = 11;
const LUZ = "255,241,214"; // branco quente

type Props = {
  imagem: string;
  efeito: EfeitoRaridade;
  nivel: NivelEfeitos;
  onPronto: () => void;
};

export default function Antecipacao({ imagem, efeito, nivel, onPronto }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const prontoRef = useRef(onPronto);
  prontoRef.current = onPronto;

  const frestas = useMemo(
    () =>
      Array.from({ length: N_FRESTAS }, (_, i) => ({
        angulo: (360 / N_FRESTAS) * i + (Math.random() - 0.5) * 22,
        comprimento: 90 + Math.random() * 150,
        largura: 1.5 + Math.random() * 3,
        brilho: 0.45 + Math.random() * 0.55,
      })),
    []
  );

  useGSAP(
    () => {
      const dur = Math.max(0.6, efeito.antecipacaoMs / 1000);
      const comMovimento = nivel === "completo";
      const { tl, dispose } = createTimeline(
        { onComplete: () => prontoRef.current() },
        { limiteMs: dur * 1000 + 1500, instantanea: nivel === "desligado" }
      );
      const q = gsap.utils.selector(raiz);
      playSfx("bau-carregando");

      // A tela em volta escurece; o brilho atrás do baú cresce.
      tl.fromTo(q(".ant-vinheta"), { opacity: 0 }, { opacity: 1, duration: dur * 0.8, ease: "power1.in" }, 0);
      tl.fromTo(q(".ant-brilho"), { opacity: 0, scale: 0.5 }, { opacity: 0.9, scale: 1.4, duration: dur * 0.85, ease: "power2.in" }, 0);

      // O baú incha e treme: o tremor cresce e acalma pouco antes do fim
      // (gb-tremor), o silêncio antes da explosão.
      tl.fromTo(q(".ant-bau"), { scale: 1 }, { scale: 1.12, duration: dur * 0.85, ease: "power1.in" }, 0);
      if (comMovimento) {
        tl.to(q(".ant-bau"), { x: 5 + 7 * efeito.intensidade, rotation: 2 + 3 * efeito.intensidade, duration: dur * 0.85, ease: "gb-tremor" }, 0);
      }

      // Frestas de luz acendem uma a uma, em ordem aleatória, e piscam.
      tl.fromTo(
        q(".ant-fresta"),
        { opacity: 0, scaleY: 0 },
        {
          opacity: (i: number) => frestas[i].brilho,
          scaleY: 1,
          duration: dur * 0.45,
          ease: "power2.out",
          stagger: { each: (dur * 0.4) / N_FRESTAS, from: "random" },
        },
        dur * 0.2
      );
      if (comMovimento) {
        tl.to(q(".ant-frestas"), { rotation: 18, duration: dur, ease: "none" }, 0);
        // repeat/yoyo dentro do stagger: cada fresta pisca sozinha. No tween,
        // o GSAP repetiria o grupo escalonado inteiro (4× mais longo).
        tl.to(q(".ant-fresta"), { opacity: 0.25, duration: 0.07, ease: "none", stagger: { each: 0.05, from: "random", repeat: 3, yoyo: true } }, dur * 0.6);
      }

      // Implosão: tudo se recolhe por um instante antes do estouro.
      const imp = dur * 0.86;
      tl.to(q(".ant-bau"), { scaleX: 1.2, scaleY: 0.92, x: 0, rotation: 0, duration: 0.12, ease: "power2.in" }, imp);
      tl.to(q(".ant-fresta"), { scaleY: 0.12, opacity: 1, duration: 0.12, ease: "power2.in" }, imp);
      tl.to(q(".ant-brilho"), { scale: 0.65, opacity: 1, duration: 0.12, ease: "power2.in" }, imp);

      return dispose;
    },
    { scope: raiz }
  );

  return (
    <div
      ref={raiz}
      style={{
        position: "absolute", inset: 0, background: "#09090b",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}
    >
      <div
        className="ant-brilho gb-luz"
        style={{
          position: "absolute", width: 300, height: 300, borderRadius: "50%", opacity: 0,
          background: `radial-gradient(circle, rgba(${LUZ},0.6) 0%, rgba(${LUZ},0.2) 38%, transparent 70%)`,
        }}
      />

      {/* Frestas: cada uma num suporte girado; o GSAP anima só o miolo. */}
      <div className="ant-frestas" style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
        {frestas.map((f, i) => (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, transform: `rotate(${f.angulo}deg)` }}>
            <div
              className="ant-fresta gb-luz"
              style={{
                position: "absolute", bottom: 40, left: -f.largura / 2,
                width: f.largura, height: f.comprimento, transformOrigin: "50% 100%", opacity: 0,
                borderRadius: f.largura,
                background: `linear-gradient(to top, rgba(${LUZ},1), rgba(${LUZ},0.35) 55%, rgba(${LUZ},0))`,
              }}
            />
          </div>
        ))}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ant-bau"
        src={imagem}
        alt=""
        style={{ position: "relative", width: 160, height: 160, objectFit: "contain", zIndex: 2 }}
      />

      <div
        className="ant-vinheta"
        style={{
          position: "absolute", inset: 0, opacity: 0, pointerEvents: "none", zIndex: 3,
          background: "radial-gradient(circle at center, transparent 22%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.93) 72%)",
        }}
      />
    </div>
  );
}
