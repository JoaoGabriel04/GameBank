'use client';

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, staggerItem, backdrop, slideUp } from "@/lib/animations";
import { Loader2, Crown, Shield, Image, Sparkles, Coins, Check, X, Ban } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { buyShopItemApi, buyDiamondsApi, buyCoinsWithDiamondsApi } from "@/services/api/shop";
import { useToast } from "@/components/Toast";
import UserBanner from "@/components/UserBanner";
import CoinIcon from "@/components/CoinIcon";
import DiamondIcon from "@/components/DiamondIcon";
import { Chip } from "@/components/user/UserUI";
import type { ShopItem } from "@/types/shop";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type ItemType = "title" | "badge" | "banner";

interface CoinPack {
  id: string;
  name: string;
  coins: number;
  price: number;
}

interface DiamondPack {
  id: string;
  name: string;
  diamonds: number;
  brl: string;
  highlight?: boolean;
}

const TYPE_META: Record<ItemType, { label: string; color: string; tone: "amber" | "violet" | "sky" }> = {
  title:  { label: "Título",  color: "#f59e0b", tone: "amber"  },
  badge:  { label: "Emblema", color: "#a78bfa", tone: "violet" },
  banner: { label: "Banner",  color: "#38bdf8", tone: "sky"    },
};

const RARITY_META: Record<string, { label: string; color: string }> = {
  comum:      { label: "Comum",      color: "#a1a1aa" },
  raro:       { label: "Raro",       color: "#7dd3fc" },
  super_raro: { label: "Super Raro", color: "#c4b5fd" },
  epico:      { label: "Épico",      color: "#a78bfa" },
  lendario:   { label: "Lendário",   color: "#fcd34d" },
};

const COIN_PACKS: CoinPack[] = [
  { id: "c1", name: "Bolsinha",  coins: 1000,   price: 20   },
  { id: "c2", name: "Sacola",    coins: 3000,   price: 55   },
  { id: "c3", name: "Baú",       coins: 7500,   price: 120  },
  { id: "c4", name: "Tonel",     coins: 18000,  price: 275  },
  { id: "c5", name: "Carroça",   coins: 40000,  price: 580  },
  { id: "c6", name: "Tesouro",   coins: 100000, price: 1350 },
];

const DIAMOND_PACKS: DiamondPack[] = [
  { id: "d1", name: "Punhado",   diamonds: 80,   brl: "R$ 9,90"   },
  { id: "d2", name: "Bolsa",     diamonds: 200,  brl: "R$ 24,90"  },
  { id: "d3", name: "Saco",      diamonds: 500,  brl: "R$ 59,90",  highlight: true },
  { id: "d4", name: "Mochila",   diamonds: 1200, brl: "R$ 139,90" },
  { id: "d5", name: "Baú Real",  diamonds: 3000, brl: "R$ 329,90" },
  { id: "d6", name: "Tesouro",   diamonds: 8000, brl: "R$ 849,90" },
];

/* ─── Section header ────────────────────────────────────────────────────── */
function SectionHeader({
  label,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  sub?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 my-6 first:mt-0 px-3 py-2 rounded-r-xl"
      style={{
        background: `linear-gradient(90deg, ${color}28 0%, transparent 100%)`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span className="font-jaro text-[18px] text-zinc-100">{label}</span>
      {sub && (
        <span className="font-inconsolata text-[10px] text-zinc-600 ml-1">{sub}</span>
      )}
    </div>
  );
}

/* ─── Cosmetic card ─────────────────────────────────────────────────────── */
function CosmeticCard({
  item,
  onSelect,
}: {
  item: ShopItem;
  onSelect: (item: ShopItem) => void;
}) {
  const meta      = TYPE_META[item.type as ItemType] ?? TYPE_META.title;
  const rMeta     = item.rarity ? RARITY_META[item.rarity] : null;
  const glowColor = rMeta?.color ?? meta.color;
  const isBanner  = item.type === "banner";
  const topBg     = isBanner && item.value
    ? item.value
    : `radial-gradient(ellipse at 50% 60%, ${glowColor}2e 0%, #0d0d10 70%)`;

  return (
    <motion.div variants={staggerItem}>
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex flex-col overflow-hidden w-full cursor-pointer outline-none transition-all hover:-translate-y-0.5"
      style={{
        borderRadius: 14,
        border: `1px solid ${glowColor}30`,
        boxShadow: rMeta && rMeta.color !== "#a1a1aa"
          ? `0 0 16px -8px ${glowColor}77`
          : "none",
      }}
    >
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{ height: 96, background: topBg }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
            opacity: 0.85,
          }}
        />
        {rMeta && (
          <span
            className="absolute top-1.5 right-1.5 font-inconsolata uppercase"
            style={{
              fontSize: 8, letterSpacing: "0.06em",
              color: glowColor,
              background: glowColor + "22",
              border: `1px solid ${glowColor}44`,
              borderRadius: 4, padding: "1px 4px", lineHeight: "13px",
            }}
          >
            {rMeta.label}
          </span>
        )}
        {!isBanner && (
          <div style={{ color: glowColor, filter: `drop-shadow(0 0 12px ${glowColor}99)` }}>
            {item.type === "title"  && <Crown  size={40} />}
            {item.type === "badge" && item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="w-10 h-10 object-contain" />
            ) : item.type === "badge" ? (
              <Shield size={40} />
            ) : null}
          </div>
        )}
        <span
          className="absolute bottom-1.5 left-2 font-inconsolata uppercase"
          style={{ fontSize: 8, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
        >
          {meta.label}
        </span>
      </div>

      <div
        className="px-2.5 pt-2.5 pb-3"
        style={{ background: "#111113", borderTop: `1px solid ${glowColor}22` }}
      >
        <p className="font-jaro text-[13px] text-zinc-100 leading-tight mb-1.5">{item.name}</p>
        <span className="inline-flex items-center gap-1 font-jaro text-[13px] text-amber-300">
          <CoinIcon size={11} className="text-amber-400" />
          {item.price.toLocaleString("pt-BR")}
        </span>
      </div>
    </button>
    </motion.div>
  );
}

/* ─── Coin pack card ────────────────────────────────────────────────────── */
const COIN_IMGS: Record<string, string> = {
  c1: "/images/coin-shop-1.png",
  c2: "/images/coin-shop-2.png",
  c3: "/images/coin-shop-3.png",
  c4: "/images/coin-shop-4.png",
  c5: "/images/coin-shop-5.png",
  c6: "/images/coin-shop-6.png",
};

function CoinPackCard({
  pack,
  onBuy,
}: {
  pack: CoinPack;
  onBuy: (pack: CoinPack) => void;
}) {
  const imgSrc = COIN_IMGS[pack.id];
  const coinLabel = pack.coins >= 1000
    ? `${(pack.coins / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}K`
    : pack.coins.toLocaleString("pt-BR");
  return (
    <motion.div variants={staggerItem}>
    <button
      type="button"
      onClick={() => onBuy(pack)}
      className="flex flex-col overflow-hidden w-full cursor-pointer outline-none transition-all hover:-translate-y-0.5"
      style={{
        borderRadius: 14,
        border: "1px solid rgba(251,191,36,0.25)",
        boxShadow: "0 0 16px -8px rgba(251,191,36,0.35)",
      }}
    >
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{ height: 96, background: "radial-gradient(ellipse at 50% 60%, rgba(251,191,36,0.2) 0%, #0d0d10 70%)" }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg,transparent,#fbbf24,transparent)", opacity: 0.8 }} />
        {imgSrc && (
          <img src={imgSrc} alt="" className="w-3/4 h-3/4 object-cover" />
        )}
      </div>
      <div
        className="px-2.5 pt-2.5 pb-3"
        style={{ background: "#111113", borderTop: "1px solid rgba(251,191,36,0.15)" }}
      >
        <p className="font-jaro text-[13px] text-zinc-100 leading-tight mb-1.5">{coinLabel} Coins</p>
        <span className="inline-flex items-center gap-1 font-jaro text-[14px] text-cyan-300">
          <DiamondIcon size={13} /> {pack.price}
        </span>
      </div>
    </button>
    </motion.div>
  );
}

/* ─── Diamond pack card ─────────────────────────────────────────────────── */
function DiamondPackCard({
  pack,
  onBuy,
}: {
  pack: DiamondPack;
  onBuy: (pack: DiamondPack) => void;
}) {
  return (
    <motion.div variants={staggerItem}>
    <button
      type="button"
      onClick={() => onBuy(pack)}
      className="flex flex-col overflow-hidden w-full cursor-pointer outline-none transition-all hover:-translate-y-0.5 relative"
      style={{
        borderRadius: 14,
        border: pack.highlight
          ? "1.5px solid rgba(34,211,238,0.65)"
          : "1px solid rgba(34,211,238,0.2)",
        boxShadow: pack.highlight
          ? "0 0 24px -6px rgba(34,211,238,0.5)"
          : "0 0 16px -10px rgba(34,211,238,0.3)",
      }}
    >
      {pack.highlight && (
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center">
          <span
            className="font-inconsolata font-bold uppercase"
            style={{
              fontSize: 8, letterSpacing: "0.08em",
              background: "#22d3ee", color: "#09090b",
              padding: "2px 8px", borderRadius: "0 0 6px 6px",
            }}
          >
            MAIS POPULAR
          </span>
        </div>
      )}

      <div
        className="relative overflow-hidden flex flex-col items-center justify-center gap-1"
        style={{ height: 96, background: "radial-gradient(ellipse at 50% 60%, rgba(34,211,238,0.18) 0%, #0d0d10 70%)" }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg,transparent,#22d3ee,transparent)", opacity: 0.85 }} />
        <span
          className="text-[26px] leading-none"
          style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.8))" }}
        >
          💎
        </span>
        <span className="font-jaro text-[18px] text-cyan-300">
          {pack.diamonds.toLocaleString("pt-BR")}
        </span>
      </div>

      <div
        className="px-2.5 pt-2.5 pb-3"
        style={{ background: "#111113", borderTop: "1px solid rgba(34,211,238,0.15)" }}
      >
        <p className="font-jaro text-[12px] text-zinc-200 leading-tight mb-1.5">{pack.name}</p>
        <span className="font-inconsolata text-[12px] font-semibold text-green-400">
          {pack.brl}
        </span>
      </div>
    </button>
    </motion.div>
  );
}

/* ─── Detail bottom sheet ─────────────────────────────────────────────────── */
function DetailSheet({
  item,
  userCoins,
  onClose,
  onBuy,
  buying,
}: {
  item: ShopItem | null;
  userCoins: number;
  onClose: () => void;
  onBuy: (item: ShopItem) => void;
  buying: boolean;
}) {
  if (!item) return null;

  const meta      = TYPE_META[item.type as ItemType] ?? TYPE_META.title;
  const rMeta     = item.rarity ? RARITY_META[item.rarity] : null;
  const accent    = rMeta?.color ?? meta.color;
  const isBanner  = item.type === "banner";
  const canAfford = userCoins >= item.price;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        variants={backdrop}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      />
      <motion.div
        className="relative bg-zinc-950 border-t border-zinc-800 rounded-t-2xl shadow-2xl overflow-y-auto"
        style={{ maxHeight: "72vh" }}
        variants={slideUp}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="w-9 h-1 rounded-sm bg-zinc-700 mx-auto mt-3" />
        <div className="flex flex-col gap-4 p-5 pb-8">

          <div className="flex items-start justify-between gap-3">
            {isBanner && item.value ? (
              <UserBanner banner={item.value} spriteId={null} className="flex-1 rounded-2xl" style={{ height: 64 }} />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl grid place-items-center shrink-0"
                style={{ background: accent + "22", color: accent, boxShadow: `0 0 32px -8px ${accent}` }}
              >
                {item.type === "title"  && <Crown  size={26} />}
                {item.type === "badge"  && <Shield size={26} />}
                {item.type === "banner" && <Image  size={26} />}
              </div>
            )}
            <button type="button" onClick={onClose}
              className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-1 shrink-0">
              <X size={16} />
            </button>
          </div>

          <div>
            <h3 className="font-jaro text-[22px] text-white leading-tight mb-2">{item.name}</h3>
            <div className="flex gap-1.5 flex-wrap">
              <Chip tone={meta.tone}>{meta.label}</Chip>
              {rMeta && (
                <span
                  className="inline-flex items-center gap-1 font-inconsolata uppercase text-[10px] rounded-lg px-2 py-0.5 border"
                  style={{ color: accent, background: accent + "18", borderColor: accent + "40", letterSpacing: "0.08em" }}
                >
                  <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ background: accent }} />
                  {rMeta.label}
                </span>
              )}
            </div>
            {item.description && (
              <p className="font-inconsolata text-[11px] text-zinc-400 leading-relaxed mt-3">
                {item.description}
              </p>
            )}
          </div>

          <div className="border-t border-zinc-800" />

          <div className="flex items-center justify-between">
            <span className="font-inconsolata text-xs text-zinc-500">Preço</span>
            <span className="inline-flex items-center gap-1.5 font-jaro text-[22px] text-amber-300">
              <CoinIcon size={18} className="text-amber-400" />
              {item.price.toLocaleString("pt-BR")}
            </span>
          </div>

          {!canAfford && (
            <div className="bg-rose-500/8 border border-rose-500/20 rounded-xl px-3 py-2.5">
              <p className="font-inconsolata text-xs text-rose-400">
                Faltam <strong>{(item.price - userCoins).toLocaleString("pt-BR")}</strong> coins para comprar.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={buying || !canAfford}
            onClick={() => onBuy(item)}
            className={`w-full flex items-center justify-center gap-2 font-inconsolata font-semibold text-sm rounded-xl px-5 py-3 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              canAfford
                ? "bg-green-500 text-zinc-950 hover:bg-green-400 shadow-[0_0_20px_-6px_rgba(74,222,128,0.55)]"
                : "border border-zinc-700 text-zinc-500"
            }`}
          >
            {buying ? <Loader2 size={16} className="animate-spin" />
              : canAfford ? <><CoinIcon size={16} />Comprar agora</>
              : <><Ban size={16} />Coins insuficientes</>
            }
          </button>

          {canAfford && (
            <p className="font-inconsolata text-[10px] text-zinc-600 text-center">
              Saldo após: <span className="text-zinc-500">{(userCoins - item.price).toLocaleString("pt-BR")} coins</span>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── 3-column animated grid ────────────────────────────────────────────── */
function Grid3({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function LojaPage() {
  const { token, loadFromStorage } = useAuthStore();
  const { profile, shopItems, loadProfile, loadShopItems, loading } = useProfileStore();
  const { success, error } = useToast();

  const [selected, setSelected] = useState<ShopItem | null>(null);
  const [buying, setBuying]     = useState(false);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => {
    if (token) {
      if (!profile) loadProfile();
      if (!shopItems.length) loadShopItems();
    }
  }, [token, profile, shopItems.length, loadProfile, loadShopItems]);

  const [coins, setCoins]       = useState<number | null>(null);
  const [diamonds, setDiamonds] = useState<number | null>(null);
  const userCoins    = coins    ?? profile?.coins    ?? 0;
  const userDiamonds = diamonds ?? profile?.diamonds ?? 0;

  useEffect(() => {
    if (profile) {
      setCoins(profile.coins);
      setDiamonds(profile.diamonds ?? 0);
    }
  }, [profile]);

  const ownedIds = useMemo(
    () => new Set((profile?.items ?? []).map(i => i.id)),
    [profile?.items]
  );

  const available = useMemo(
    () => shopItems.filter(i => i.available && !ownedIds.has(i.id)),
    [shopItems, ownedIds]
  );

  const titles  = available.filter(i => i.type === "title");
  const badges  = available.filter(i => i.type === "badge");
  const banners = available.filter(i => i.type === "banner");

  async function handleBuyCosmetic(item: ShopItem) {
    setBuying(true);
    try {
      await buyShopItemApi(item.id);
      setCoins(c => (c ?? 0) - item.price);
      success(`"${item.name}" comprado!`);
      await loadProfile();
      setSelected(null);
    } catch (e: any) {
      error(e?.response?.data?.message ?? "Erro ao comprar.");
    } finally {
      setBuying(false);
    }
  }

  async function handleBuyCoinPack(pack: CoinPack) {
    if (userDiamonds < pack.price) {
      error(`Você precisa de ${pack.price} 💎 para comprar este pacote.`);
      return;
    }
    try {
      await buyCoinsWithDiamondsApi(pack.id);
      setDiamonds(d => (d ?? 0) - pack.price);
      setCoins(c => (c ?? 0) + pack.coins);
      success(`+${pack.coins.toLocaleString("pt-BR")} coins adicionados!`);
    } catch (e: any) {
      error(e?.response?.data?.message ?? "Erro ao comprar coins.");
    }
  }

  async function handleBuyDiamondPack(pack: DiamondPack) {
    try {
      await buyDiamondsApi(pack.id);
      setDiamonds(d => (d ?? 0) + pack.diamonds);
      success(`+${pack.diamonds} 💎 adicionados!`);
    } catch (e: any) {
      error(e?.response?.data?.message ?? "Erro ao comprar diamantes.");
    }
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-inconsolata text-sm text-zinc-500">
        Faça login para acessar a loja.
      </div>
    );
  }

  if ((loading.shop || loading.profile) && !shopItems.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pt-16 lg:pt-6 relative">



      {/* Títulos */}
      {titles.length > 0 && (
        <section className="mb-10">
          <SectionHeader label="Títulos" icon={Crown} color="#f59e0b" sub={`${titles.length} disponíveis`} />
          <Grid3>{titles.map(i => <CosmeticCard key={i.id} item={i} onSelect={setSelected} />)}</Grid3>
        </section>
      )}

      {/* Emblemas */}
      {badges.length > 0 && (
        <section className="mb-10">
          <SectionHeader label="Emblemas" icon={Shield} color="#a78bfa" sub={`${badges.length} disponíveis`} />
          <Grid3>{badges.map(i => <CosmeticCard key={i.id} item={i} onSelect={setSelected} />)}</Grid3>
        </section>
      )}

      {/* Banners */}
      {banners.length > 0 && (
        <section className="mb-10">
          <SectionHeader label="Banners" icon={Image} color="#38bdf8" sub={`${banners.length} disponíveis`} />
          <Grid3>{banners.map(i => <CosmeticCard key={i.id} item={i} onSelect={setSelected} />)}</Grid3>
        </section>
      )}

      {/* Coins */}
      <section className="mb-10">
        <SectionHeader label="Coins" icon={Coins} color="#fbbf24" sub={`seu saldo: ${userCoins.toLocaleString("pt-BR")}`} />
        <p className="font-inconsolata text-[11px] text-zinc-600 mb-3">
          Compre coins com seus 💎 Diamantes.
        </p>
        <Grid3>
          {COIN_PACKS.map(p => (
            <CoinPackCard key={p.id} pack={p} onBuy={handleBuyCoinPack} />
          ))}
        </Grid3>
      </section>

      {/* Diamantes */}
      <section className="mb-10">
        <SectionHeader label="Diamantes" icon={Sparkles} color="#22d3ee" sub={`seu saldo: ${userDiamonds} 💎`} />
        <p className="font-inconsolata text-[11px] text-zinc-600 mb-3">
          Diamantes são a moeda premium do GameBank. Compra 100% segura.
        </p>
        <Grid3>
          {DIAMOND_PACKS.map(p => (
            <DiamondPackCard key={p.id} pack={p} onBuy={handleBuyDiamondPack} />
          ))}
        </Grid3>
      </section>

      <AnimatePresence>
        {selected && (
          <DetailSheet
            item={selected}
            userCoins={userCoins}
            onClose={() => setSelected(null)}
            onBuy={handleBuyCosmetic}
            buying={buying}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
