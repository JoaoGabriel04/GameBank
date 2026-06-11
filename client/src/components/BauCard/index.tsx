'use client'

import CoinIcon from "@/components/CoinIcon"
import DiamondIcon from "@/components/DiamondIcon"

type BauCardProps = {
  bau: {
    tipo: string
    nome: string
    precoCoins?: number | null
    precoDiamonds?: number | null
  }
  onAbrir: (bau: BauCardProps["bau"]) => void
}

const IMAGENS: Record<string, string> = {
  comum:    "/images/Cofrinho.png",
  premium:  "/images/Cofre Premium.png",
  lendario: "/images/Cofre Lendário.png",
}

const COR: Record<string, string> = {
  comum:    "#00BE03",
  premium:  "#9D00FF",
  lendario: "#FFC800",
}

export default function BauCard({ bau, onAbrir }: BauCardProps) {
  const cor = COR[bau.tipo] ?? "#a78bfa"

  return (
    <button
      type="button"
      onClick={() => onAbrir(bau)}
      className="flex flex-col overflow-hidden w-full cursor-pointer outline-none transition-all hover:-translate-y-0.5"
      style={{
        borderRadius: 14,
        border: `1px solid ${cor}30`,
        boxShadow: `0 0 16px -8px ${cor}77`,
      }}
    >
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{ height: 96, background: `radial-gradient(ellipse at 50% 60%, ${cor}2e 0%, #0d0d10 70%)` }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${cor}, transparent)`, opacity: 0.85 }}
        />
        <img
          src={IMAGENS[bau.tipo] ?? "/images/Cofrinho.png"}
          alt={bau.nome}
          className="w-12 h-12 object-contain"
        />
        <span
          className="absolute bottom-1.5 left-2 font-inconsolata uppercase"
          style={{ fontSize: 8, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
        >
          Baú
        </span>
      </div>

      <div
        className="px-2.5 pt-2.5 pb-3"
        style={{ background: "#111113", borderTop: `1px solid ${cor}22` }}
      >
        <p className="font-jaro text-[13px] text-zinc-100 leading-tight mb-1.5">{bau.nome}</p>
        <span className="inline-flex items-center gap-1 font-jaro text-[13px]"
          style={{ color: bau.precoCoins ? "#fbbf24" : "#22d3ee" }}>
          {bau.precoCoins ? (
            <><CoinIcon size={11} className="text-amber-400" /> {bau.precoCoins.toLocaleString("pt-BR")}</>
          ) : (
            <><DiamondIcon size={14} /> {bau.precoDiamonds}</>
          )}
        </span>
      </div>
    </button>
  )
}
