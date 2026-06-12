/* eslint-disable */
'use client'

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { staggerContainer, staggerItem, backdrop, modalBox } from "@/lib/animations"
import { Loader2, ShoppingCart, CheckCircle, History, X } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { useToast } from "@/components/Toast"
import DiamondIcon from "@/components/DiamondIcon"
import {
  getDiamondPackagesApi,
  startDiamondCheckoutApi,
  getDiamondHistoryApi,
  type DiamondPackage,
  type DiamondPurchaseHistory,
} from "@/services/api/shop"

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function DiamantesPag() {
  const { user } = useAuthStore()
  const { error: toastError } = useToast()
  const [packages, setPackages] = useState<DiamondPackage[]>([])
  const [history, setHistory] = useState<DiamondPurchaseHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<number | null>(null)
  const [confirmPkg, setConfirmPkg] = useState<DiamondPackage | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [tab, setTab] = useState<"buy" | "history">("buy")

  useEffect(() => {
    getDiamondPackagesApi()
      .then(setPackages)
      .catch(() => toastError("Erro ao carregar pacotes"))
      .finally(() => setLoading(false))
    // toastError is stable — intentionally excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab !== "history") return
    getDiamondHistoryApi()
      .then(setHistory)
      .catch(() => toastError("Erro ao carregar histórico"))
    // toastError is stable — intentionally excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function iniciarCompra(packageId: number) {
    if (buying) return
    setConfirmPkg(null)
    setCheckingOut(true)
    setBuying(packageId)
    try {
      const { checkoutUrl, sandboxUrl } = await startDiamondCheckoutApi(packageId)
      const url = process.env.NODE_ENV === "production" ? checkoutUrl : sandboxUrl
      if (!url) throw new Error("URL de checkout não disponível")
      window.location.href = url
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao iniciar compra"
      toastError(message)
      setBuying(null)
      setCheckingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24 px-4">
      <div className="max-w-2xl mx-auto pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DiamondIcon size={36} />
            <div>
              <h1 className="text-2xl font-bold">Diamantes</h1>
              <p className="text-zinc-400 text-sm">Compre diamantes para itens premium</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-1.5 bg-zinc-800 rounded-full px-3 py-1.5">
              <DiamondIcon size={18} />
              <span className="font-semibold text-cyan-300">{user.diamonds ?? 0}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("buy")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "buy"
                ? "bg-cyan-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <ShoppingCart size={16} />
            Comprar
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "history"
                ? "bg-cyan-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <History size={16} />
            Histórico
          </button>
        </div>

        {/* Comprar */}
        {tab === "buy" && (
          <>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-cyan-400" size={32} />
              </div>
            ) : packages.length === 0 ? (
              <div className="text-center text-zinc-500 py-16">
                Nenhum pacote disponível no momento.
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {packages.map((pkg) => {
                  const total = Math.floor(pkg.diamonds * (1 + pkg.bonusPct / 100))
                  const isLoading = buying === pkg.id
                  return (
                    <motion.div
                      key={pkg.id}
                      variants={staggerItem}
                      className="relative bg-zinc-900 border border-zinc-700 rounded-2xl p-5 flex flex-col gap-3 hover:border-cyan-600 transition-colors"
                    >
                      {pkg.bonusPct > 0 && (
                        <span className="absolute top-3 right-3 bg-cyan-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          +{pkg.bonusPct}% bônus
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <DiamondIcon size={28} />
                        <div>
                          <p className="font-semibold text-white">{pkg.name}</p>
                          {pkg.description && (
                            <p className="text-xs text-zinc-400">{pkg.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-3xl font-bold text-cyan-300">{total.toLocaleString("pt-BR")}</span>
                        <span className="text-zinc-400 text-sm ml-1">diamantes</span>
                        {pkg.bonusPct > 0 && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {pkg.diamonds.toLocaleString("pt-BR")} + {(total - pkg.diamonds).toLocaleString("pt-BR")} bônus
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setConfirmPkg(pkg)}
                        disabled={!!buying}
                        className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
                      >
                        {isLoading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <>
                            <ShoppingCart size={16} />
                            {formatBRL(pkg.priceInCents)}
                          </>
                        )}
                      </button>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
            <p className="text-center text-xs text-zinc-600 mt-6">
              Pagamento processado com segurança via Mercado Pago. Pix e cartão aceitos.
            </p>
          </>
        )}

        {/* Histórico */}
        {tab === "history" && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center text-zinc-500 py-16">
                Nenhuma compra realizada ainda.
              </div>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-green-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">{h.package.name}</p>
                      <p className="text-xs text-zinc-500">{formatDate(h.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <DiamondIcon size={14} />
                      <span className="text-cyan-300 font-semibold text-sm">
                        +{h.diamondsGranted.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">{formatBRL(h.amountPaidCents)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Confirmação de compra */}
      <AnimatePresence>
        {confirmPkg && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              variants={backdrop} initial="hidden" animate="visible" exit="exit"
              onClick={() => setConfirmPkg(null)}
            />
            <motion.div
              className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "#0d0d10", border: "1px solid rgba(34,211,238,0.25)" }}
              variants={modalBox} initial="hidden" animate="visible" exit="exit"
            >
              <div className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: "linear-gradient(90deg, transparent, #22d3ee, transparent)" }} />
              <div className="flex flex-col gap-4 px-6 py-7">
                <div className="flex items-center justify-between">
                  <p className="text-[18px] font-bold text-white">Confirmar compra</p>
                  <button type="button" onClick={() => setConfirmPkg(null)}
                    className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-1">
                    <X size={16} />
                  </button>
                </div>

                <div className="bg-zinc-900/60 rounded-xl p-4 flex items-center gap-3"
                  style={{ border: "1px solid rgba(34,211,238,0.15)" }}>
                  <DiamondIcon size={32} className="shrink-0" />
                  <div>
                    <p className="font-bold text-[15px] text-white">
                      {Math.floor(confirmPkg.diamonds * (1 + confirmPkg.bonusPct / 100)).toLocaleString("pt-BR")} Diamantes
                    </p>
                    <p className="text-xs text-zinc-500">{confirmPkg.name}</p>
                    {confirmPkg.bonusPct > 0 && (
                      <p className="text-xs text-cyan-500 mt-0.5">+{confirmPkg.bonusPct}% bônus incluído</p>
                    )}
                  </div>
                  <div className="ml-auto text-right shrink-0">
                    <span className="font-semibold text-[16px] text-green-400">
                      {formatBRL(confirmPkg.priceInCents)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 text-center leading-relaxed">
                  Você será redirecionado para o Mercado Pago para concluir o pagamento com segurança.
                </p>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmPkg(null)}
                    className="flex-1 font-semibold text-sm rounded-xl px-4 py-2.5 transition-all cursor-pointer"
                    style={{ background: "#18181b", border: "1px solid rgba(113,113,122,0.3)", color: "#a1a1aa" }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={() => iniciarCompra(confirmPkg.id)}
                    className="flex-1 flex items-center justify-center gap-2 font-semibold text-sm rounded-xl px-4 py-2.5 transition-all cursor-pointer"
                    style={{ background: "#22d3ee", color: "#09090b" }}>
                    <ShoppingCart size={14} />
                    Ir para pagamento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Overlay de redirecionamento */}
      <AnimatePresence>
        {checkingOut && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              variants={backdrop} initial="hidden" animate="visible" exit="exit"
            />
            <motion.div
              className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "#0d0d10", border: "1px solid rgba(34,211,238,0.2)" }}
              variants={modalBox} initial="hidden" animate="visible" exit="exit"
            >
              <div className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: "linear-gradient(90deg, transparent, #22d3ee, transparent)" }} />
              <div className="flex flex-col items-center gap-4 px-6 py-8">
                <div className="w-16 h-16 rounded-full grid place-items-center"
                  style={{ background: "rgba(34,211,238,0.1)", boxShadow: "0 0 32px -8px rgba(34,211,238,0.4)" }}>
                  <Loader2 size={28} className="animate-spin" style={{ color: "#22d3ee" }} />
                </div>
                <div className="text-center">
                  <p className="text-[20px] font-bold text-white">Redirecionando...</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Aguarde enquanto abrimos a página de pagamento segura.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
