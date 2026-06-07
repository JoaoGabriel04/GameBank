'use client'

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { staggerContainer, staggerItem } from "@/lib/animations"
import { Loader2, ShoppingCart, CheckCircle, History } from "lucide-react"
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
                        onClick={() => iniciarCompra(pkg.id)}
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
    </div>
  )
}
