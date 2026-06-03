'use client'

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import { buyShopItemApi, equipShopItemApi } from "@/services/api/shop"
import UserBadge from "@/components/UserBadge"
import UserBanner from "@/components/UserBanner"
import { resolveBadge } from "@/constants/badges"
import { useBannerCatalog } from "@/hooks/useBannerCatalog"
import type { ShopItem, UserItem } from "@/types/shop"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { faCoins, faPalette, faGem, faCrown, faCheck, faLock, faShoppingBag, faImage } from "@fortawesome/free-solid-svg-icons"
import { Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react"

// ── Configuração visual por tipo de item ─────────────────────────────────────

type ItemType = "title" | "badge" | "banner" | string

const TYPE_CONFIG: Record<string, {
  label: string
  icon: IconDefinition
  gradient: string
  glow: string
  accent: string
  iconColor: string
}> = {
  title: {
    label: "Títulos",
    icon: faCrown,
    gradient: "from-violet-600/20 via-purple-600/10 to-transparent",
    glow: "shadow-[0_0_24px_rgba(139,92,246,0.25)]",
    accent: "text-violet-400",
    iconColor: "text-violet-400",
  },
  badge: {
    label: "Emblemas",
    icon: faGem,
    gradient: "from-cyan-600/20 via-blue-600/10 to-transparent",
    glow: "shadow-[0_0_24px_rgba(6,182,212,0.25)]",
    accent: "text-cyan-400",
    iconColor: "text-cyan-400",
  },
  banner: {
    label: "Banners",
    icon: faImage,
    gradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.25)]",
    accent: "text-emerald-400",
    iconColor: "text-emerald-400",
  },
}

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? {
    label: "Itens",
    icon: faGem,
    gradient: "from-zinc-600/20 to-transparent",
    glow: "",
    accent: "text-zinc-400",
    iconColor: "text-zinc-400",
  }
}

const FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "title", label: "Títulos" },
  { value: "badge", label: "Emblemas" },
  { value: "banner", label: "Banners" },
]

// ── Componente do card de item ────────────────────────────────────────────────

function ShopItemCard({
  item,
  owned,
  equipped,
  canAfford,
  onBuy,
  onEquip,
  buying,
  spriteId,
}: {
  item: ShopItem
  owned: boolean
  equipped: boolean
  canAfford: boolean
  onBuy: () => void
  onEquip: () => void
  buying: boolean
  spriteId?: string | null
}) {
  const cfg = getConfig(item.type)
  const isBanner = item.type === "banner"

  return (
    <div
      className={`
        relative flex flex-col rounded-2xl overflow-hidden border transition-all duration-300
        bg-zinc-900
        ${equipped
          ? `border-violet-500/60 ${cfg.glow}`
          : owned
          ? "border-zinc-700 hover:border-zinc-500"
          : canAfford
          ? "border-zinc-800 hover:border-zinc-600 hover:scale-[1.02]"
          : "border-zinc-800 opacity-60"
        }
      `}
    >
      {/* Faixa superior com gradiente */}
      <div className={`h-24 w-full relative`}>
        {isBanner ? (
          <UserBanner banner={item.value ?? null} spriteId={spriteId ?? null} className="absolute inset-0" />
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}
          >
            <div className={`${item.type === "badge" ? "flex flex-col items-center gap-1" : ""}`}>
              <div className={`w-14 h-14 rounded-2xl bg-zinc-900/70 backdrop-blur-sm border border-white/5 flex items-center justify-center`}>
                {item.type === "badge" ? (
                  <UserBadge
                    badge={item.value ? JSON.parse(item.value).badge : undefined}
                    variant="medium"
                  />
                ) : (
                  <FontAwesomeIcon icon={cfg.icon} className={`text-2xl ${cfg.iconColor}`} />
                )}
              </div>
              {item.type === "badge" && (
                <span className="text-[10px] font-inconsolata text-zinc-400 text-center max-w-[70px]">
                  {(() => {
                    const badgeData = item.value ? JSON.parse(item.value) : null;
                    const preset = resolveBadge(badgeData?.badge);
                    return preset?.label || "";
                  })()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Badge "Equipado" */}
        {equipped && (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-violet-600 text-white text-[10px] font-inconsolata font-semibold px-2 py-0.5 rounded-full">
            <FontAwesomeIcon icon={faCheck} className="text-[8px]" />
            Equipado
          </span>
        )}

        {/* Badge "Possuído" */}
        {owned && !equipped && (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-zinc-700 text-zinc-300 text-[10px] font-inconsolata px-2 py-0.5 rounded-full">
            <FontAwesomeIcon icon={faCheck} className="text-[8px]" />
            Possuído
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <div>
          <span className={`text-[10px] font-inconsolata uppercase tracking-widest ${cfg.accent}`}>
            {getConfig(item.type).label}
          </span>
          <h3 className="text-sm font-jaro text-zinc-100 leading-tight mt-0.5 line-clamp-1">
            {item.name}
          </h3>
        </div>

        {item.type === "badge" ? (
          <div className="space-y-2 flex-1">
            <p className="text-xs font-inconsolata text-zinc-500 leading-relaxed">
              {(() => {
                const badgeData = item.value ? JSON.parse(item.value) : null;
                const preset = resolveBadge(badgeData?.badge);
                return preset?.description || item.description;
              })()}
            </p>
            <div className="flex items-center gap-2">
              {(() => {
                const badgeData = item.value ? JSON.parse(item.value) : null;
                const preset = resolveBadge(badgeData?.badge);
                if (preset) {
                  const rarityColors: Record<string, string> = {
                    common: "bg-zinc-700 text-zinc-200",
                    rare: "bg-blue-700 text-blue-200",
                    epic: "bg-purple-700 text-purple-200",
                    legendary: "bg-yellow-700 text-yellow-200",
                  };
                  const color = rarityColors[preset.rarity] || rarityColors.common;
                  return (
                    <span className={`text-[10px] font-inconsolata font-semibold px-2 py-1 rounded ${color} capitalize`}>
                      {preset.rarity}
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        ) : item.type === "banner" ? (
          <p className="text-xs font-inconsolata text-zinc-500 leading-relaxed line-clamp-2 flex-1">
            {item.description || "Banner de perfil personalizável."}
          </p>
        ) : (
          <p className="text-xs font-inconsolata text-zinc-500 leading-relaxed line-clamp-2 flex-1">
            {item.description}
          </p>
        )}

        {/* Preço + Botão */}
        <div className="flex items-center justify-between mt-2 pt-3 border-t border-zinc-800 gap-2">
          {!owned ? (
            <div className="flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-lg">
              <FontAwesomeIcon icon={faCoins} className="text-amber-400 text-xs" />
              <span className="text-amber-300 text-xs font-inconsolata font-semibold">{item.price}</span>
            </div>
          ) : (
            <div className="w-2" />
          )}

          {equipped ? (
            <button
              onClick={onEquip}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-inconsolata font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer"
            >
              {buying ? <Loader2 className="w-3 h-3 animate-spin" /> : <FontAwesomeIcon icon={faCheck} className="text-[10px]" />}
              Desequipar
            </button>
          ) : owned ? (
            <button
              onClick={onEquip}
              disabled={buying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-inconsolata font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              {buying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Equipar
            </button>
          ) : (
            <button
              onClick={onBuy}
              disabled={!canAfford || buying}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-inconsolata font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                canAfford
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-zinc-700 text-zinc-500"
              }`}
            >
              {buying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : canAfford ? (
                <FontAwesomeIcon icon={faShoppingBag} className="text-[10px]" />
              ) : (
                <FontAwesomeIcon icon={faLock} className="text-[10px]" />
              )}
              {canAfford ? "Comprar" : "Sem coins"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function LojaPage() {
  const router = useRouter()
  const { user, token, loadFromStorage } = useAuthStore()
  const { profile, shopItems, loading, loadShopItems, loadProfile } = useProfileStore()
  const [myItems, setMyItems] = useState<UserItem[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [buyingId, setBuyingId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null)
  const bannerCatalog = useBannerCatalog()
  const spriteByBannerId = useMemo(() => {
    const m = new Map<number, string | null>();
    bannerCatalog?.forEach((b) => m.set(b.id, b.spriteId));
    return m;
  }, [bannerCatalog])

  useEffect(() => { loadFromStorage() }, [loadFromStorage])

  useEffect(() => {
    if (user?.isAdmin) router.replace("/admin/loja")
  }, [user, router])

  useEffect(() => {
    if (token) {
      loadShopItems()
      loadProfile()
    }
  }, [token, loadShopItems, loadProfile])

  useEffect(() => {
    if (!profile) return
    // Drop items with invalid (null/0/NaN) id — they would never match a real
    // ShopItem and cause confusing 'Item não encontrado' errors on equip/buy.
    // Padrão (id=0) is the synthetic default banner and is always kept.
    const cleaned = profile.items.filter(
      (i) => i.id === 0 || (Number.isFinite(i.id) && (i.id as number) > 0)
    )
    setMyItems(cleaned)
  }, [profile])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(t)
  }, [feedback])

  const filteredItems = useMemo(() => {
    if (filter === "all") return shopItems
    return shopItems.filter((i) => i.type === filter)
  }, [shopItems, filter])

  const coins = profile?.coins ?? 0
  const ownedCount = myItems.length
  const totalCount = shopItems.length

  const handleBuy = async (item: ShopItem) => {
    setBuyingId(item.id)
    setFeedback(null)
    try {
      await buyShopItemApi(item.id)
      setFeedback({ type: "success", msg: `"${item.name}" adicionado à sua coleção!` })
      loadProfile()
      loadShopItems()
    } catch (err: any) {
      setFeedback({ type: "error", msg: err?.response?.data?.message || "Erro ao comprar item" })
    } finally {
      setBuyingId(null)
    }
  }

  const handleEquip = async (item: ShopItem) => {
    setBuyingId(item.id)
    setFeedback(null)
    try {
      await equipShopItemApi(item.id)
      const equipped = myItems.some((i) => i.id === item.id && i.equipped)
      setFeedback({ type: "success", msg: equipped ? `"${item.name}" desequipado.` : `"${item.name}" equipado!` })
      loadProfile()
    } catch (err: any) {
      setFeedback({ type: "error", msg: err?.response?.data?.message || "Erro ao equipar item" })
    } finally {
      setBuyingId(null)
    }
  }

  if (!user || !token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-400">
        <FontAwesomeIcon icon={faShoppingBag} className="text-4xl text-zinc-600" />
        <p className="font-inconsolata text-sm">Faça login para acessar a loja.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24 pt-16 lg:pt-0">
      

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Glow decorativo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-40 bg-violet-600/10 blur-3xl rounded-full" />
          <div className="absolute top-0 right-1/4 w-72 h-32 bg-amber-500/8 blur-3xl rounded-full" />
        </div>

        <div className="relative max-w-2xl mx-auto px-4 pt-8 pb-6">
          {/* Cabeçalho + coins */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="font-jaro text-3xl text-zinc-100 leading-none">Loja</h1>
              <p className="font-inconsolata text-sm text-zinc-500 mt-1">
                {ownedCount} de {totalCount} itens na coleção
              </p>
            </div>

            {/* Wallet de coins */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                <FontAwesomeIcon icon={faCoins} className="text-amber-400 text-base" />
                <span className="font-jaro text-xl text-amber-300">{coins.toLocaleString("pt-BR")}</span>
              </div>
              <span className="text-[10px] font-inconsolata text-zinc-600">GameCoins</span>
            </div>
          </div>

          {/* Barra de progresso da coleção */}
          {totalCount > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-inconsolata text-zinc-600 uppercase tracking-widest">Progresso da coleção</span>
                <span className="text-[10px] font-inconsolata text-zinc-500">{Math.round((ownedCount / totalCount) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all duration-700"
                  style={{ width: `${(ownedCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Filtros por categoria */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-inconsolata font-medium transition-all duration-200 cursor-pointer ${
                  filter === opt.value
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                {opt.value !== "all" && (
                  <FontAwesomeIcon icon={getConfig(opt.value).icon} className={`mr-1.5 text-[10px] ${filter === opt.value ? "text-zinc-700" : getConfig(opt.value).iconColor}`} />
                )}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4">
        <div className={`overflow-hidden transition-all duration-300 ${feedback ? "max-h-16 mb-4" : "max-h-0 mb-0"}`}>
          {feedback && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-inconsolata ${
              feedback.type === "success"
                ? "bg-green-950/60 border-green-700/40 text-green-300"
                : "bg-red-950/60 border-red-700/40 text-red-300"
            }`}>
              {feedback.type === "success"
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <XCircle className="w-4 h-4 shrink-0" />
              }
              {feedback.msg}
            </div>
          )}
        </div>
      </div>

      {/* ── Grid de itens ────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4">
        {loading.shop ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-600">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-inconsolata text-sm">Carregando itens...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-600">
            <FontAwesomeIcon icon={faShoppingBag} className="text-4xl" />
            <p className="font-inconsolata text-sm">
              {filter === "all" ? "Nenhum item disponível." : "Nenhum item nesta categoria."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const owned = myItems.some((i) => i.id === item.id)
              const equipped = myItems.some((i) => i.id === item.id && i.equipped)
              return (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  owned={owned}
                  equipped={equipped}
                  canAfford={coins >= item.price}
                  onBuy={() => handleBuy(item)}
                  onEquip={() => handleEquip(item)}
                  buying={buyingId === item.id}
                  spriteId={item.bannerId != null ? spriteByBannerId.get(item.bannerId) ?? null : null}
                />
              )
            })}
          </div>
        )}
      </main>

      
    </div>
  )
}
