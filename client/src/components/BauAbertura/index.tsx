'use client'

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { RARIDADES } from "@/constants/raridade"
import BauItemPreview from "@/components/BauItemPreview"
import BauParticulas from "@/components/BauParticulas"
import CoinIcon from "@/components/CoinIcon"

export type ItemResultado = {
  id: number
  name: string
  type: string
  value?: string | null
  imageUrl?: string | null
  raridade: string
  animated?: boolean | null
  fragmentosGanhos: number
  fragmentosAtuais: number
  fragmentosTotal?: number | null
  itemCompleto: boolean
}

export type BauResultado = {
  tipoBau: string
  coinsGanhos: number
  fragmentosTotal: number
  xpBonus?: number
  itens: ItemResultado[]
}

type Fase = "luz" | "coins" | "itens" | "suspense" | "resumo"

type BauAberturaProps = {
  resultado: BauResultado | null
  onClose: () => void
}

const BAU_IMAGENS: Record<string, string> = {
  comum:    "/images/Cofrinho.png",
  premium:  "/images/Cofre Premium.png",
  lendario: "/images/Cofre Lendário.png",
}

const BAU_CORES: Record<string, string> = {
  comum:    "#00BE03",
  premium:  "#9D00FF",
  lendario: "#FFC800",
}

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? "-100%" : "100%",
    opacity: 0,
    transition: { duration: 0.2 },
  }),
}

export default function BauAbertura({ resultado, onClose }: BauAberturaProps) {
  const [fase, setFase] = useState<Fase>("luz")
  const [itemIdx, setItemIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [resumoVisiveis, setResumoVisiveis] = useState<number[]>([])
  const [bloqueado, setBloqueado] = useState(false)

  useEffect(() => {
    if (!resultado) return
    setFase("luz")
    setItemIdx(0)
    setDirection(1)
    setResumoVisiveis([])
    setBloqueado(false)

    const t = setTimeout(() => setFase("coins"), 2500)
    return () => clearTimeout(t)
  }, [resultado])

  useEffect(() => {
    if (fase !== "resumo" || !resultado) return
    resultado.itens.forEach((_, i) => {
      setTimeout(() => {
        setResumoVisiveis((prev) => [...prev, i])
      }, i * 180)
    })
  }, [fase, resultado])

  const avancar = useCallback(() => {
    if (bloqueado || !resultado) return

    if (fase === "coins") {
      setDirection(1)
      setFase("itens")
      return
    }

    if (fase === "itens") {
      const proximo = itemIdx + 1

      if (proximo >= resultado.itens.length) {
        setFase("resumo")
        return
      }

      const proximoItem = resultado.itens[proximo]
      const isNextLendario = proximoItem.raridade === "LENDARIO"

      if (isNextLendario) {
        setBloqueado(true)
        setDirection(1)
        setItemIdx(proximo)
        setFase("suspense")

        setTimeout(() => {
          setFase("itens")
          setBloqueado(false)
        }, 3000)
      } else {
        setDirection(1)
        setItemIdx(proximo)
      }
    }

    if (fase === "resumo") {
      if (resumoVisiveis.length >= (resultado?.itens.length ?? 0)) {
        onClose()
      }
    }
  }, [fase, itemIdx, resultado, bloqueado, resumoVisiveis, onClose])

  if (!resultado) return null

  const item = resultado.itens[itemIdx]
  const corItem = item ? (RARIDADES[item.raridade]?.cor ?? "#a1a1aa") : "#a1a1aa"
  const isLendario = item?.raridade === "LENDARIO"
  const corBau = BAU_CORES[resultado.tipoBau] ?? "#27272a"

  return createPortal(
    <div
      onClick={avancar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        cursor: bloqueado ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      {fase === "luz" && (
        <div style={{
          position: "absolute", inset: 0,
          background: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}>
          <motion.img
            src={BAU_IMAGENS[resultado.tipoBau] ?? "/images/Cofrinho.png"}
            alt={resultado.tipoBau}
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: [1, 1.08, 1.12], opacity: [1, 0.6, 0] }}
            transition={{ duration: 0.9, ease: "easeIn", delay: 0.2 }}
            style={{ width: 160, height: 160, objectFit: "contain", zIndex: 2 }}
          />

          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 3, 8, 8], opacity: [0, 0.8, 0.6, 0] }}
            transition={{
              duration: 1.1,
              delay: 0.4,
              times: [0, 0.2, 0.45, 1],
            }}
            style={{
              position: "absolute",
              width: 80, height: 80,
              borderRadius: "50%",
              background: "radial-gradient(circle at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.05) 70%, transparent 100%)",
              boxShadow: "0 0 80px 40px rgba(255,255,255,0.3)",
              zIndex: 10,
              filter: "blur(2px)",
            }}
          />
        </div>
      )}

      {fase === "coins" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: "absolute", inset: 0,
            background: "#09090b",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <div style={{
            width: 200, height: 200,
            borderRadius: "50%",
            border: "2px solid #fbbf2466",
            boxShadow: "0 0 30px #fbbf2444, 0 0 60px #fbbf2422",
            background: "#09090b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "bau-circle-pulse 2s ease-in-out infinite",
            "--rarity-color": "#fbbf24",
            "--rarity-color-dim": "#fbbf2444",
          } as React.CSSProperties}>
            <CoinIcon size={80} />
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: "center" }}
          >
            {resultado.xpBonus ? (
              <>
                <p style={{
                  fontFamily: "var(--font-jaro)",
                  fontSize: 32,
                  color: "#fbbf24",
                  margin: 0,
                }}>
                  +{resultado.xpBonus} XP
                </p>
                <p style={{
                  fontFamily: "var(--font-inconsolata)",
                  fontSize: 13,
                  color: "#22d3ee",
                  marginTop: 4,
                }}>
                  Bônus por baú vazio
                </p>
              </>
            ) : (
              <>
                <p style={{
                  fontFamily: "var(--font-jaro)",
                  fontSize: 32,
                  color: "#fbbf24",
                  margin: 0,
                }}>
                  +{resultado.coinsGanhos.toLocaleString("pt-BR")}
                </p>
                <p style={{
                  fontFamily: "var(--font-inconsolata)",
                  fontSize: 13,
                  color: "#71717a",
                  marginTop: 4,
                }}>
                  Coins garantidos
                </p>
              </>
            )}
          </motion.div>

          <p style={{
            fontFamily: "var(--font-inconsolata)",
            fontSize: 12,
            color: "#52525b",
            position: "absolute",
            bottom: 48,
          }}>
            Clique para continuar...
          </p>
        </motion.div>
      )}

      {(fase === "itens" || fase === "suspense") && item && (
        <div
          style={{
            position: "absolute", inset: 0,
            backgroundColor: "#09090b",
            backgroundImage: item.raridade === "RARO"
              ? "linear-gradient(to bottom, #09090b, #0a3b1e)"
              : item.raridade === "EPICO"
              ? "linear-gradient(to bottom, #09090b, #1f0033)"
              : isLendario
              ? "linear-gradient(-45deg, #2a1500, #5c2d00, #b85a00, #fbbf2433)"
              : "none",
            backgroundSize: isLendario ? "400% 400%" : undefined,
            animation: isLendario ? "bau-lendario-bg 4s ease infinite" : undefined,
            transition: "background-color 0.5s, background-image 0.5s",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >

          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            key={`rar-${item.id}`}
            style={{
              background: `${corItem}22`,
              border: `1px solid ${corItem}66`,
              borderRadius: 20,
              padding: "6px 20px",
              fontFamily: "var(--font-jaro)",
              fontSize: 14,
              color: corItem,
              zIndex: 1,
            }}
          >
            {RARIDADES[item.raridade]?.label}
          </motion.div>

          <div style={{ position: "relative", zIndex: 1 }}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={item.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className={fase === "suspense" ? "bau-suspense-pulse" : ""}
              >
                <BauItemPreview item={item} size={200} />
              </motion.div>
            </AnimatePresence>

            {(item.raridade === "EPICO" || item.raridade === "LENDARIO") && (
              <BauParticulas
                cor={corItem}
                ativo={fase === "itens"}
                qtd={item.raridade === "LENDARIO" ? 20 : 12}
              />
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`info-${item.id}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ delay: 0.15 }}
              style={{ textAlign: "center", zIndex: 1 }}
            >
              <p style={{
                fontFamily: "var(--font-inconsolata)",
                fontSize: 13,
                color: corItem,
                marginBottom: 4,
              }}>
                +{item.fragmentosGanhos} 🧩
              </p>
              <p style={{
                fontFamily: "var(--font-jaro)",
                fontSize: 22,
                color: "#f4f4f5",
                margin: "0 0 12px",
              }}>
                {item.name}
              </p>

              {item.fragmentosTotal && (
                <div style={{ width: 260, margin: "0 auto 8px" }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--font-inconsolata)",
                    fontSize: 11,
                    color: "#71717a",
                    marginBottom: 6,
                  }}>
                    <span>🧩 {item.fragmentosAtuais}/{item.fragmentosTotal}</span>
                    <span>{Math.round(
                      (item.fragmentosAtuais / item.fragmentosTotal) * 100
                    )}%</span>
                  </div>
                  <div style={{
                    background: "#27272a",
                    borderRadius: 4,
                    height: 6,
                    overflow: "hidden",
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100,
                        (item.fragmentosAtuais / item.fragmentosTotal) * 100
                      )}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                      style={{ height: "100%", background: corItem, borderRadius: 4 }}
                    />
                  </div>
                </div>
              )}

              {item.itemCompleto && (
                <p style={{
                  fontFamily: "var(--font-inconsolata)",
                  fontSize: 12,
                  color: "#4ade80",
                  marginTop: 4,
                }}>
                  ✨ Item desbloqueado!
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          <div style={{
            position: "absolute",
            bottom: 48,
            textAlign: "center",
            zIndex: 1,
          }}>
            <div style={{
              background: "#1a1a1a",
              border: "1px solid #27272a",
              borderRadius: 20,
              padding: "8px 20px",
              fontFamily: "var(--font-inconsolata)",
              fontSize: 13,
              color: "#a1a1aa",
              marginBottom: 8,
            }}>
              {resultado.itens.length - itemIdx - 1} itens restantes
            </div>
            <p style={{
              fontFamily: "var(--font-inconsolata)",
              fontSize: 11,
              color: "#52525b",
              margin: 0,
            }}>
              {fase === "suspense"
                ? "Prepare-se..."
                : itemIdx < resultado.itens.length - 1
                ? "Clique para revelar..."
                : "Clique para ver o resumo..."}
            </p>
          </div>
        </div>
      )}

      {fase === "resumo" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: "absolute", inset: 0,
            background: "#09090b",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "48px 24px 100px",
            overflowY: "auto",
          }}
        >
          <p style={{
            fontFamily: "var(--font-jaro)",
            fontSize: 22,
            color: "#f4f4f5",
            marginBottom: 24,
          }}>
            Resumo do baú
          </p>

          {resultado.xpBonus ? (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#09090b",
                border: "1px solid #22d3ee22",
                borderLeft: "3px solid #22d3ee",
                borderRadius: "0 10px 10px 0",
                padding: "10px 16px",
                marginBottom: 8,
              }}
            >
              <span style={{
                fontFamily: "var(--font-inconsolata)",
                fontSize: 13,
                color: "#d4d4d8",
              }}>XP Bônus</span>
              <span style={{
                fontFamily: "var(--font-inconsolata)",
                fontSize: 14,
                color: "#22d3ee",
                fontWeight: 600,
              }}>
                +{resultado.xpBonus}
              </span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#09090b",
                border: "1px solid #fbbf2422",
                borderLeft: "3px solid #fbbf24",
                borderRadius: "0 10px 10px 0",
                padding: "10px 16px",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CoinIcon size={20} />
                <span style={{
                  fontFamily: "var(--font-inconsolata)",
                  fontSize: 13,
                  color: "#d4d4d8",
                }}>Coins</span>
              </div>
              <span style={{
                fontFamily: "var(--font-inconsolata)",
                fontSize: 14,
                color: "#fbbf24",
                fontWeight: 600,
              }}>
                +{resultado.coinsGanhos.toLocaleString("pt-BR")}
              </span>
            </motion.div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl">
            {resultado.itens.map((i, idx) => {
              const cor = RARIDADES[i.raridade]?.cor ?? "#a1a1aa"
              const visivel = resumoVisiveis.includes(idx)

              return (
                <motion.div
                  key={i.id}
                  initial={{ y: 30, opacity: 0 }}
                  animate={visivel ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="flex flex-col items-center gap-2 text-center p-3 sm:p-4"
                  style={{
                    background: "#09090b",
                    border: `1px solid ${cor}22`,
                    borderTop: `2px solid ${cor}66`,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ width: 56, height: 56 }}>
                    <BauItemPreview item={i} size={56} />
                  </div>

                  <p style={{
                    fontFamily: "var(--font-inconsolata)",
                    fontSize: 11,
                    color: "#d4d4d8",
                    margin: 0,
                    lineHeight: 1.3,
                  }}>
                    {i.name}
                  </p>

                  <p style={{
                    fontFamily: "var(--font-inconsolata)",
                    fontSize: 11,
                    color: cor,
                    margin: 0,
                  }}>
                    +{i.fragmentosGanhos} 🧩
                  </p>

                  {i.itemCompleto && (
                    <span style={{ fontSize: 10, color: "#4ade80" }}>✨</span>
                  )}
                </motion.div>
              )
            })}
          </div>

          <AnimatePresence>
            {resumoVisiveis.length >= resultado.itens.length && (
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                onClick={(e) => { e.stopPropagation(); onClose() }}
                style={{
                  position: "fixed",
                  bottom: 32,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 16,
                  padding: "12px 40px",
                  fontFamily: "var(--font-inconsolata)",
                  fontSize: 14,
                  color: "#d4d4d8",
                  cursor: "pointer",
                  zIndex: 10,
                }}
              >
                Fechar
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>,
    document.body
  )
}
