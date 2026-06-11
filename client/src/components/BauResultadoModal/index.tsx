'use client'

import { useState, useEffect }        from "react"
import { motion, AnimatePresence }    from "framer-motion"
import { modalBox, backdrop }         from "@/lib/animations"
import { RARIDADES }                  from "@/constants/raridade"

type ItemResultado = {
  id: number
  name: string
  type: string
  value?: string | null
  imageUrl?: string | null
  raridade: string
  fragmentosGanhos: number
  fragmentosAtuais: number
  fragmentosTotal?: number | null
  itemCompleto: boolean
  animated?: boolean | null
}

type BauResultado = {
  tipoBau: string
  coinsGanhos: number
  fragmentosTotal: number
  xpBonus?: number
  itens: ItemResultado[]
}

type BauResultadoModalProps = {
  resultado: BauResultado | null
  onClose: () => void
}

const IMAGENS: Record<string, string> = {
  comum:    "/images/Cofrinho.png",
  premium:  "/images/Cofre Premium.png",
  lendario: "/images/Cofre Lendário.png",
}

const COIN_IMG = "/images/coin.png"

const BAU_CORES: Record<string, string> = {
  comum:    "#22c55e",
  premium:  "#22d3ee",
  lendario: "#f4f4f5",
}

/* --- ItemPreview ---------------------------------------------------------- */
function ItemPreview({ item }: { item: ItemResultado }) {
  const cor = RARIDADES[item.raridade as keyof typeof RARIDADES]?.cor ?? "#27272a"

  return (
    <div style={{
      width: 100, height: 100,
      borderRadius: "50%",
      overflow: "hidden",
      margin: "0 auto 16px",
      position: "relative",
      border: `2px solid ${cor}44`,
      boxShadow: `0 0 20px ${cor}33`,
      background: "#09090b",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {item.type === "badge" && item.imageUrl && (
        <img src={item.imageUrl} alt={item.name}
          style={{ width: "70%", height: "70%", objectFit: "contain" }} />
      )}
      {item.type === "badge" && !item.imageUrl && (
        <span style={{ fontSize: 32, opacity: 0.4 }}>🛡️</span>
      )}

      {item.type === "banner" && (
        <div style={{
          position: "absolute", inset: 0,
          background: item.value?.startsWith("https://")
            ? `url(${item.value}) center/cover`
            : item.value ?? "#27272a",
        }} />
      )}

      {item.type === "frame" && (
        <div className="relative" style={{ width: 64, height: 64 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#3f3f46", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#71717a" }}>
            👤
          </div>
          {(() => {
            const src = item.value?.startsWith("http") ? item.value : item.imageUrl?.startsWith("http") ? item.imageUrl : null;
            if (src) return <img src={src} alt="" className="absolute pointer-events-none" style={{ top: "50%", left: "50%", width: "136%", height: "136%", maxWidth: "none", transform: "translate(-50%, -50%)", objectFit: "contain" }} />;
            if (item.value) return <div className="absolute" style={{ inset: -3, borderRadius: "50%", padding: 3, backgroundImage: item.value, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />;
            return null;
          })()}
        </div>
      )}

      {item.type === "title" && (
        <span style={{ fontSize: 36 }}>👑</span>
      )}
    </div>
  )
}

/* --- ItemPreviewSmall ----------------------------------------------------- */
function ItemPreviewSmall({ item }: { item: ItemResultado }) {
  const cor = RARIDADES[item.raridade as keyof typeof RARIDADES]?.cor ?? "#27272a"

  return (
    <div style={{
      width: 40, height: 40,
      borderRadius: "50%",
      overflow: "hidden",
      position: "relative",
      border: `1.5px solid ${cor}44`,
      boxShadow: `0 0 10px ${cor}22`,
      background: "#09090b",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      {item.type === "badge" && item.imageUrl && (
        <img src={item.imageUrl} alt={item.name}
          style={{ width: "70%", height: "70%", objectFit: "contain" }} />
      )}
      {item.type === "badge" && !item.imageUrl && (
        <span style={{ fontSize: 14, opacity: 0.4 }}>🛡️</span>
      )}

      {item.type === "banner" && (
        <div style={{
          position: "absolute", inset: 0,
          background: item.value?.startsWith("https://")
            ? `url(${item.value}) center/cover`
            : item.value ?? "#27272a",
        }} />
      )}

      {item.type === "frame" && (
        <div className="relative" style={{ width: 28, height: 28 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#3f3f46", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#71717a" }}>
            👤
          </div>
          {(() => {
            const src = item.value?.startsWith("http") ? item.value : item.imageUrl?.startsWith("http") ? item.imageUrl : null;
            if (src) return <img src={src} alt="" className="absolute pointer-events-none" style={{ top: "50%", left: "50%", width: "136%", height: "136%", maxWidth: "none", transform: "translate(-50%, -50%)", objectFit: "contain" }} />;
            if (item.value) return <div className="absolute" style={{ inset: -2, borderRadius: "50%", padding: 2, backgroundImage: item.value, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />;
            return null;
          })()}
        </div>
      )}

      {item.type === "title" && (
        <span style={{ fontSize: 14 }}>👑</span>
      )}
    </div>
  )
}

/* --- Modal ---------------------------------------------------------------- */
export default function BauResultadoModal({ resultado, onClose }: BauResultadoModalProps) {
  const [itemAtual, setItemAtual] = useState(0)
  const [fase, setFase] = useState<"shaking" | "coins" | "itens" | "fim">("shaking")

  useEffect(() => {
    if (resultado) {
      setItemAtual(0)
      setFase("shaking")
    }
  }, [resultado])

  useEffect(() => {
    if (resultado && fase === "shaking") {
      const timer = setTimeout(() => setFase("coins"), 900)
      return () => clearTimeout(timer)
    }
  }, [resultado, fase])

  function avancar() {
    if (fase === "coins") {
      if ((resultado?.itens.length ?? 0) > 0) {
        setFase("itens")
      } else {
        setFase("fim")
      }
      return
    }
    if (fase === "itens") {
      if (itemAtual < (resultado?.itens.length ?? 1) - 1) {
        setItemAtual(prev => prev + 1)
      } else {
        setFase("fim")
      }
    }
  }

  const item = resultado?.itens[itemAtual]
  const totalItens = resultado?.itens.length ?? 0

  const corRaridade = item?.raridade
    ? (RARIDADES[item.raridade as keyof typeof RARIDADES]?.cor ?? null)
    : null
  const corBau = resultado?.tipoBau
    ? (BAU_CORES[resultado.tipoBau] ?? null)
    : null

  let modalBorderStyle: React.CSSProperties = {}
  if (fase === "shaking" && corBau) {
    modalBorderStyle = {
      border: `1px solid ${corBau}33`,
      boxShadow: `0 0 40px ${corBau}22`,
    }
  } else if (fase === "coins") {
    modalBorderStyle = {
      border: "1px solid #fbbf2433",
      boxShadow: "0 0 40px #fbbf2422",
    }
  } else if ((fase === "itens" || fase === "fim") && corRaridade) {
    modalBorderStyle = {
      border: `1px solid ${corRaridade}33`,
      boxShadow: `0 0 40px ${corRaridade}22, 0 0 80px ${corRaridade}11`,
    }
  }

  return (
    <AnimatePresence>
      {resultado && (
        <motion.div
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] px-4"
        >
          <motion.div
            variants={modalBox}
            onClick={e => e.stopPropagation()}
            style={{
              background: "linear-gradient(160deg, #0c0c0f, #111115)",
              borderRadius: 20,
              padding: 24,
              maxWidth: 380,
              width: "100%",
              transition: "border-color 0.4s, box-shadow 0.4s",
              ...modalBorderStyle,
            }}
          >
            {/* Fase 0: Cofrinho tremendo */}
            {fase === "shaking" && (
              <motion.div
                key="shaking"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 2 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <img
                  src={IMAGENS[resultado.tipoBau] ?? "/images/Cofrinho.png"}
                  alt="Cofrinho"
                  className="w-32 h-32 object-contain pig-shaking"
                />
                <p className="font-inconsolata text-xs text-zinc-500 mt-4 animate-pulse">
                  Quebrando o cofrinho...
                </p>
              </motion.div>
            )}

            {/* Fase 1: Coins garantidos */}
            {fase === "coins" && (
              <motion.div
                key="coins"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <img
                  src={COIN_IMG}
                  className="w-20 h-20 object-contain mx-auto mb-3"
                  alt="Coins"
                />
                <h2 className="font-jaro text-2xl text-amber-400">
                  +{resultado.coinsGanhos.toLocaleString("pt-BR")} Coins
                </h2>
                {resultado.xpBonus && (
                  <p className="font-jaro text-lg text-green-400 mt-1">
                    +{resultado.xpBonus.toLocaleString("pt-BR")} XP
                  </p>
                )}
                <p className="font-inconsolata text-xs text-zinc-500 mt-1 mb-6">
                  garantidos neste baú
                </p>
                <button onClick={avancar}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-inconsolata text-sm rounded-xl transition-colors cursor-pointer">
                  {(resultado?.itens.length ?? 0) > 0 ? "Ver fragmentos →" : "Ver resumo →"}
                </button>
              </motion.div>
            )}

            {/* Fase 2: Itens um a um */}
            {fase === "itens" && item && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={item.id}
                  initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <p className="font-inconsolata text-xs text-zinc-600 mb-3">
                    {itemAtual + 1} / {totalItens}
                  </p>

                  <ItemPreview item={item} />

                  <p className="font-inconsolata text-xs mb-1"
                    style={{ color: RARIDADES[item.raridade as keyof typeof RARIDADES]?.cor }}>
                    ● {RARIDADES[item.raridade as keyof typeof RARIDADES]?.label}
                  </p>

                  <h2 className="font-jaro text-lg text-zinc-100 mb-1">{item.name}</h2>

                  <p className="font-inconsolata text-xs text-zinc-400 mb-2">
                    🧩 +{item.fragmentosGanhos} fragmentos
                    {item.fragmentosTotal && (
                      <span className="text-zinc-600 ml-1">
                        ({item.fragmentosAtuais}/{item.fragmentosTotal})
                      </span>
                    )}
                  </p>

                  {item.fragmentosTotal && (
                    <div className="bg-zinc-800 rounded-full h-1.5 overflow-hidden mb-3">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100,
                          (item.fragmentosAtuais / item.fragmentosTotal) * 100
                        )}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{ background: RARIDADES[item.raridade as keyof typeof RARIDADES]?.cor }}
                      />
                    </div>
                  )}

                  {item.itemCompleto && (
                    <p className="font-inconsolata text-xs text-green-400 mb-3 font-semibold">
                      ✨ Item desbloqueado!
                    </p>
                  )}

                  <button onClick={avancar}
                    className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-inconsolata text-sm rounded-xl transition-colors cursor-pointer">
                    {itemAtual < totalItens - 1 ? "Próximo →" : "Ver resumo →"}
                  </button>
                </motion.div>
              </AnimatePresence>
            )}

            {/* Fase 3: Resumo final */}
            {fase === "fim" && (
              <motion.div key="fim" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p className="font-jaro text-lg text-zinc-100 mb-4">Resumo do baú</p>

                <div className="flex justify-between items-center mb-2"
                  style={{
                    background: "#09090b",
                    borderRadius: "0 10px 10px 0",
                    borderLeft: "3px solid #fbbf2466",
                    padding: "8px 12px",
                  }}>
                  <span className="font-inconsolata text-xs text-zinc-400">
                    <img src={COIN_IMG} className="w-4 h-4 object-contain inline-block align-middle mr-1" alt="" />
                    Coins
                  </span>
                  <span className="font-inconsolata text-sm text-amber-400 font-semibold">
                    +{resultado.coinsGanhos.toLocaleString("pt-BR")}
                  </span>
                </div>

                {resultado.xpBonus && (
                  <div className="flex justify-between items-center mb-2"
                    style={{
                      background: "#09090b",
                      borderRadius: "0 10px 10px 0",
                      borderLeft: "3px solid #4ade8066",
                      padding: "8px 12px",
                    }}>
                    <span className="font-inconsolata text-xs text-zinc-400">
                      ✨ XP
                    </span>
                    <span className="font-inconsolata text-sm text-green-400 font-semibold">
                      +{resultado.xpBonus.toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
                  {resultado.itens.map(i => (
                    <div key={i.id}
                      style={{
                        borderLeft: `3px solid ${RARIDADES[i.raridade as keyof typeof RARIDADES]?.cor ?? "#27272a"}66`,
                        background: "#09090b",
                        borderRadius: "0 10px 10px 0",
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}>
                      <ItemPreviewSmall item={i} />

                      <div className="flex-1 min-w-0">
                        <p className="font-inconsolata text-xs text-zinc-300 truncate">
                          {i.name}
                          {i.itemCompleto && (
                            <span className="text-green-400 ml-1">✨</span>
                          )}
                        </p>
                        <p className="font-inconsolata text-[10px]"
                           style={{ color: RARIDADES[i.raridade as keyof typeof RARIDADES]?.cor }}>
                          {RARIDADES[i.raridade as keyof typeof RARIDADES]?.label}
                        </p>
                      </div>

                      <span className="font-inconsolata text-xs flex-shrink-0"
                            style={{ color: RARIDADES[i.raridade as keyof typeof RARIDADES]?.cor }}>
                        +{i.fragmentosGanhos}
                      </span>
                    </div>
                  ))}
                </div>

                <button onClick={onClose}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-inconsolata text-sm rounded-xl transition-colors cursor-pointer">
                  Fechar
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
