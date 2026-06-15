'use client'

import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { backdrop, modalBox } from "@/lib/animations"
import { BAU_CONFIG, type TipoBau } from "@/constants/baus"
import { RARIDADES } from "@/constants/raridade"
import CoinIcon from "@/components/CoinIcon"
import DiamondIcon from "@/components/DiamondIcon"

const IMAGENS: Record<string, string> = {
  comum:    "/images/Cofrinho.png",
  premium:  "/images/Cofre Premium.png",
  lendario: "/images/Cofre Lendário.png",
}

const BAU_CORES: Record<string, string> = {
  comum:    "#00BE03",
  premium:  "#9D00FF",
  lendario: "#FFC800",
}

type BauDetailModalProps = {
  bau: {
    tipo: string
    nome: string
    descricao: string
    precoCoins?: number | null
    precoDiamonds?: number | null
  } | null
  onClose: () => void
  onAbrir: (tipo: string) => void
  abrindo: boolean
}

export default function BauDetailModal({ bau, onClose, onAbrir, abrindo }: BauDetailModalProps) {
  if (!bau) return null
  const config = BAU_CONFIG[bau.tipo as TipoBau]
  if (!config) return null

  const cor = BAU_CORES[bau.tipo] ?? "#22c55e"

  const GARANTIAS: Record<string, { raridade: string; label: string }[]> = {
    premium:  [{ raridade: "EPICO", label: "1 Épico garantido" }],
    lendario: [
      { raridade: "EPICO",   label: "1 Épico garantido" },
      { raridade: "LENDARIO", label: "1 Lendário garantido" },
    ],
  }
  const garantias = GARANTIAS[bau.tipo]

  if (typeof window === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {bau && (
        <motion.div
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] px-4"
          onClick={onClose}
        >
          <motion.div
            variants={modalBox}
            onClick={e => e.stopPropagation()}
            style={{
              background: "linear-gradient(160deg, #0c0c0f, #111115)",
              border: `1px solid ${cor}33`,
              borderRadius: 20,
              boxShadow: `0 0 40px ${cor}22`,
              padding: 24,
              maxWidth: 380,
              width: "100%",
            }}
          >
            {/* Área da imagem com glow radial */}
            <div
              style={{
                width: "100%",
                height: 120,
                borderRadius: 12,
                background: `radial-gradient(ellipse at center, ${cor}22 0%, transparent 70%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <img
                src={IMAGENS[bau.tipo] ?? "/images/Cofrinho.png"}
                alt={bau.nome}
                className="w-24 h-24 object-contain"
              />
            </div>

            {/* Nome e descrição */}
            <h2 className="font-jaro text-xl text-zinc-100 text-center mb-1">
              {bau.nome}
            </h2>
            <p className="font-inconsolata text-xs text-zinc-500 text-center mb-4">
              {bau.descricao}
            </p>

            {/* Preço */}
            <div
              style={{
                background: "#09090b",
                border: `1px solid ${cor}22`,
                borderRadius: 12,
                padding: "10px 16px",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              <span style={{ color: cor }} className="font-jaro text-lg inline-flex items-center gap-1.5">
                {bau.precoCoins
                  ? <><CoinIcon size={14} /> {bau.precoCoins.toLocaleString("pt-BR")}</>
                  : <><DiamondIcon size={14} /> {bau.precoDiamonds}</>}
              </span>
            </div>

            {/* Stats: Itens / Coins / Fragmentos */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Itens",       value: `${config.itensMin} a ${config.itensMax}` },
                { label: "Coins",       value: `${config.coinsMin} a ${config.coinsMax}`, valueStyle: { color: "#fbbf24" } },
                { label: "Fragmentos",  value: `${config.fragmentosMin} a ${config.fragmentosMax}` },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: "#09090b",
                  border: "1px solid #27272a",
                  borderRadius: 10,
                  padding: "8px 4px",
                  textAlign: "center",
                }}>
                  <p className="font-inconsolata text-[10px] text-zinc-500 mb-0.5">
                    {stat.label}
                  </p>
                  <p className="font-inconsolata text-sm font-semibold text-zinc-200"
                     style={stat.valueStyle}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Garantias */}
            {garantias && (
              <div
                style={{
                  background: "#09090b",
                  border: "1px solid #27272a",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 12,
                }}
              >
                <p className="font-inconsolata text-[10px] text-zinc-600 uppercase tracking-wider mb-2">
                  Garantias
                </p>
                <div className="flex flex-wrap gap-2">
                  {garantias.map(g => (
                    <span key={g.raridade}
                      style={{
                        background: `${RARIDADES[g.raridade]?.cor}18`,
                        border: `1px solid ${RARIDADES[g.raridade]?.cor}44`,
                        color: RARIDADES[g.raridade]?.cor,
                        borderRadius: 20,
                        padding: "3px 12px",
                        fontSize: 12,
                      }}
                      className="font-inconsolata font-semibold"
                    >
                      {g.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Probabilidades */}
            <div
              style={{
                background: "#09090b",
                border: "1px solid #27272a",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 16,
              }}
            >
              <p className="font-inconsolata text-[10px] text-zinc-600 uppercase tracking-wider mb-2">
                Probabilidades por raridade
              </p>
              {config.probabilidadesRaridade.map(p => (
                <div key={p.raridade}
                  className="flex justify-between font-inconsolata text-xs py-0.5">
                  <span style={{ color: RARIDADES[p.raridade]?.cor }}>
                    ● {RARIDADES[p.raridade]?.label}
                  </span>
                  <span className="text-zinc-500">{p.peso}%</span>
                </div>
              ))}
            </div>

            {/* Botões */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose}
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  color: "#a1a1aa",
                }}
                className="font-inconsolata text-sm py-2.5 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={() => onAbrir(bau.tipo)} disabled={abrindo}
                style={{
                  background: `linear-gradient(135deg, ${cor}44, ${cor}22)`,
                  border: `1px solid ${cor}66`,
                  color: cor,
                  boxShadow: `0 0 16px ${cor}22`,
                }}
                className="font-inconsolata text-sm font-semibold py-2.5 rounded-xl cursor-pointer hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {abrindo ? "Abrindo..." : "Abrir agora"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
