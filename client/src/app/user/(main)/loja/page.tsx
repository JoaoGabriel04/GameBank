/* eslint-disable */
/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, staggerItem, backdrop, slideUp, modalBox, shimmerTitleStyle, legendaryTitleStyle } from "@/lib/animations";
import { Loader2, Crown, Shield, Image as ImageIcon, Sparkles, Coins, Check, X, Ban, AlertTriangle, Clock } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { buyShopItemApi, buyCoinsWithDiamondsApi, startDiamondCheckoutApi, getDiamondBalanceApi } from "@/services/api/shop";
import { useToast } from "@/components/Toast";
import UserBanner from "@/components/UserBanner";
import LegendaryTitle from "@/components/LegendaryTitle";
import CoinIcon from "@/components/CoinIcon";
import DiamondIcon from "@/components/DiamondIcon";
import { Chip } from "@/components/user/UserUI";
import type { ShopItem } from "@/types/shop";
import { RARIDADES, raridadeWeight } from "@/constants/raridade";
import { apiErrMsg } from "@/lib/api-error";
import { getBausApi, abrirBauApi } from "@/services/api/baus";
import { getDailyOffersApi, buyDailyOfferApi } from "@/services/api/shop";
import type { DailyOffer } from "@/services/api/shop";
import BauCard from "@/components/BauCard";
import BauDetailModal from "@/components/BauDetailModal";
import BauAbertura from "@/components/BauAbertura";

/* --- Types --------------------------------------------------------------- */
type ItemType = "title" | "badge" | "banner" | "frame";

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

const TYPE_META: Record<ItemType, { label: string; color: string; tone: "amber" | "violet" | "sky" | "cyan" }> = {
  title:  { label: "Título",  color: "#f59e0b", tone: "amber"  },
  badge:  { label: "Emblema", color: "#a78bfa", tone: "violet" },
  banner: { label: "Banner",  color: "#38bdf8", tone: "sky"    },
  frame:  { label: "Moldura", color: "#22d3ee", tone: "cyan"   },
};

const COIN_PACKS: CoinPack[] = [
  { id: "c1", name: "Punhado de Coins", coins: 300,   price: 50   },
  { id: "c2", name: "Saco de Coins",    coins: 800,   price: 120  },
  { id: "c3", name: "Baú de Coins",     coins: 1800,  price: 240  },
  { id: "c4", name: "Cofre de Coins",   coins: 4000,  price: 480  },
  { id: "c5", name: "Tesouro de Coins", coins: 9000,  price: 950  },
  { id: "c6", name: "Fortuna de Coins", coins: 20000, price: 1800 },
];

const DIAMOND_PACKS: DiamondPack[] = [
  { id: "d1", name: "Faísca",           diamonds: 100,  brl: "R$ 2,99"   },
  { id: "d2", name: "Cristal",          diamonds: 250,  brl: "R$ 6,99"   },
  { id: "d3", name: "Gema",             diamonds: 605,  brl: "R$ 14,99",  highlight: true },
  { id: "d4", name: "Rubi",             diamonds: 1440, brl: "R$ 29,99"  },
  { id: "d5", name: "Safira",           diamonds: 3375, brl: "R$ 59,99"  },
  { id: "d6", name: "Diamante Supremo", diamonds: 8250, brl: "R$ 119,99" },
];

/* --- Section header ------------------------------------------------------ */
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

/* --- Cosmetic card ------------------------------------------------------- */
function CosmeticCard({
  item,
  onSelect,
  fragData,
}: {
  item: ShopItem;
  onSelect: (item: ShopItem) => void;
  fragData?: { atual: number; total: number } | null;
}) {
  const meta      = TYPE_META[item.type as ItemType] ?? TYPE_META.title;
  const rMeta     = item.raridade ? RARIDADES[item.raridade] : null;
  const glowColor = rMeta?.cor ?? meta.color;
  const isBanner  = item.type === "banner";
  const isFrame   = item.type === "frame";
  const topBg     = !isBanner
    ? `radial-gradient(ellipse at 50% 60%, ${glowColor}2e 0%, #0d0d10 70%)`
    : undefined;

  return (
    <motion.div variants={staggerItem}>
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex flex-col overflow-hidden w-full cursor-pointer outline-none transition-all hover:-translate-y-0.5"
      style={{
        borderRadius: 14,
        border: `1px solid ${glowColor}30`,
        boxShadow: rMeta && rMeta.cor !== "#a1a1aa"
          ? `0 0 16px -8px ${glowColor}77`
          : "none",
      }}
    >
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{ height: 96, background: topBg }}
      >
        {isBanner && (
          <UserBanner
            banner={item.value}
            imageUrl={item.imageUrl}
            animated={item.animated}
            className="absolute inset-0 w-full h-full"
          />
        )}
        {item.animated && (
          <span className="absolute top-1.5 left-1.5 z-10 font-inconsolata uppercase text-[8px] px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-300" style={{ letterSpacing: "0.06em" }}>
            ✨
          </span>
        )}
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
          isFrame ? (
            <div className="relative" style={{ width: 44, height: 44 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#3f3f46", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, color: "#71717a" }}>
                👤
              </div>
              {(() => {
                const src = item.value?.startsWith("http") ? item.value : item.imageUrl?.startsWith("http") ? item.imageUrl : null;
                if (src) return <img src={src} alt="" className="absolute pointer-events-none" style={{ top: "50%", left: "50%", width: "136%", height: "136%", maxWidth: "none", transform: "translate(-50%, -50%)", objectFit: "contain" }} />;
                if (item.value) return <div className="absolute" style={{ inset: -3, borderRadius: "50%", padding: 3, backgroundImage: item.value, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />;
                return null;
              })()}
            </div>
          ) : (
            <div style={{ color: glowColor, filter: `drop-shadow(0 0 12px ${glowColor}99)` }}>
              {item.type === "title"  && <Crown  size={40} />}
              {item.type === "badge" && item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="w-10 h-10 object-contain" />
              ) : item.type === "badge" ? (
                <Shield size={40} />
              ) : null}
            </div>
          )
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
        {fragData ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between font-inconsolata text-[11px]">
              <span style={{ color: glowColor }}>
                🧩 {fragData.atual}/{fragData.total}
              </span>
              <span className="text-zinc-600">
                {Math.round((fragData.atual / fragData.total) * 100)}%
              </span>
            </div>
            <div className="bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (fragData.atual / fragData.total) * 100)}%`,
                  background: glowColor,
                }}
              />
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 font-jaro text-[13px] text-amber-300">
            <CoinIcon size={11} className="text-amber-400" />
            {item.price.toLocaleString("pt-BR")}
          </span>
        )}
      </div>
    </button>
    </motion.div>
  );
}

/* --- Coin pack card ------------------------------------------------------ */
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
  const coinLabel = pack.coins.toLocaleString("pt-BR");
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
          <img src={imgSrc} alt="" className="w-3/5 h-4/5 object-cover" />
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

/* --- Diamond pack card --------------------------------------------------- */
const DIAMOND_IMGS: Record<string, string> = {
  d1: "/images/diamond-shop-1.png",
  d2: "/images/diamond-shop-2.png",
  d3: "/images/diamond-shop-3.png",
  d4: "/images/diamond-shop-4.png",
  d5: "/images/diamond-shop-5.png",
  d6: "/images/diamond-shop-6.png",
};

function DiamondPackCard({
  pack,
  onBuy,
}: {
  pack: DiamondPack;
  onBuy: (pack: DiamondPack) => void;
}) {
  const imgSrc = DIAMOND_IMGS[pack.id];
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
        className="relative overflow-hidden flex items-center justify-center"
        style={{ height: 96, background: "radial-gradient(ellipse at 50% 60%, rgba(34,211,238,0.18) 0%, #0d0d10 70%)" }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg,transparent,#22d3ee,transparent)", opacity: 0.85 }} />
        {imgSrc && (
          <img src={imgSrc} alt="" className="w-3/5 h-4/5 object-cover" />
        )}
      </div>

      <div
        className="px-2.5 pt-2.5 pb-3"
        style={{ background: "#111113", borderTop: "1px solid rgba(34,211,238,0.15)" }}
      >
        <p className="font-jaro text-[13px] text-zinc-100 leading-tight mb-1.5">
          {pack.diamonds.toLocaleString("pt-BR")} Diamantes
        </p>
        <span className="font-inconsolata text-[12px] font-semibold text-green-400">
          {pack.brl}
        </span>
      </div>
    </button>
    </motion.div>
  );
}

/* --- Detail bottom sheet --------------------------------------------------- */
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
  const rMeta     = item.raridade ? RARIDADES[item.raridade] : null;
  const accent    = rMeta?.cor ?? meta.color;
  const isBanner  = item.type === "banner";
  const isFrame   = item.type === "frame";
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
        <div className="flex flex-col gap-4 p-5 pb-20 lg:pb-8">

          <div className="flex items-start justify-between gap-3">
            {isBanner && item.value ? (
              <UserBanner banner={item.value} animated={item.animated} className="flex-1 rounded-2xl" style={{ height: 64 }} />
            ) : isFrame ? (
              <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#3f3f46", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#71717a" }}>
                  👤
                </div>
                {(() => {
                  const src = item.value?.startsWith("http") ? item.value : item.imageUrl?.startsWith("http") ? item.imageUrl : null;
                  if (src) return <img src={src} alt="" className="absolute pointer-events-none" style={{ top: "50%", left: "50%", width: "136%", height: "136%", maxWidth: "none", transform: "translate(-50%, -50%)", objectFit: "contain" }} />;
                  if (item.value) return <div className="absolute" style={{ inset: -3, borderRadius: "50%", padding: 3, backgroundImage: item.value, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />;
                  return null;
                })()}
              </div>
            ) : item.type === "title" ? (
              <div className="shrink-0 w-[190px] rounded-xl overflow-hidden border border-zinc-800">
                <div className="h-7 bg-gradient-to-r from-zinc-800 to-zinc-900" />
                <div className="px-3 py-2 flex items-center gap-2 bg-zinc-900/80">
                  <div className="w-7 h-7 rounded-full bg-zinc-700 shrink-0 grid place-items-center text-xs text-zinc-500">
                    👤
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[11px] text-zinc-100 font-inconsolata truncate leading-tight">Você</span>
                    <div className="mt-0.5">
                      {(() => {
                        const titleText = (() => { try { return JSON.parse(item.value ?? "{}").title } catch { return null } })();
                        if (!item.animated) return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg border font-inconsolata text-[10px] uppercase tracking-wider whitespace-nowrap bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                            {titleText}
                          </span>
                        );
                        if (item.raridade === "LENDARIO") return (
                          <LegendaryTitle text={titleText ?? ""} />
                        );
                        return (
                          <span className="inline-block font-inconsolata text-[10px] px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10" style={shimmerTitleStyle}>
                            {titleText}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="w-14 h-14 rounded-2xl grid place-items-center shrink-0"
                style={{ background: accent + "22", color: accent, boxShadow: `0 0 32px -8px ${accent}` }}
              >
                {item.type === "badge"  && <Shield size={26} />}
                {item.type === "banner" && <ImageIcon size={26} />}
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

/* --- 3-column animated grid ---------------------------------------------- */
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

/* --- Daily offer card --------------------------------------------------- */
function DailyOfferCard({
  offer,
  onSelect,
}: {
  offer: DailyOffer;
  onSelect: (offer: DailyOffer) => void;
}) {
  const item   = offer.item;
  const rMeta  = item.raridade ? RARIDADES[item.raridade] : null;
  const glow   = rMeta?.cor ?? "#d4d4d8";
  const isBanner = item.type === "banner";
  const isFrame  = item.type === "frame";

  return (
    <button
      type="button"
      onClick={() => onSelect(offer)}
      className="flex flex-col overflow-hidden w-full cursor-pointer outline-none transition-all"
      style={{
        borderRadius: 14,
        border: `1px solid ${glow}40`,
        background: "#111113",
      }}
    >
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{ height: 92, background: isBanner && item.value ? item.value : `radial-gradient(ellipse at 50% 55%, ${glow}2e 0%, #0d0d10 68%)` }}
      >
        {isBanner && <UserBanner banner={item.value} imageUrl={item.imageUrl} className="absolute inset-0 w-full h-full" />}
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${glow}, transparent)`, opacity: 0.7 }} />
        {isBanner ? null : isFrame ? (
          <div className="relative" style={{ width: 38, height: 38 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#3f3f46", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#71717a" }}>👤</div>
            {(() => {
              const src = item.value?.startsWith("http") ? item.value : item.imageUrl?.startsWith("http") ? item.imageUrl : null;
              if (src) return <img src={src} alt="" className="absolute pointer-events-none" style={{ top: "50%", left: "50%", width: "136%", height: "136%", maxWidth: "none", transform: "translate(-50%, -50%)", objectFit: "contain" }} />;
              if (item.value) return <div className="absolute" style={{ inset: -3, borderRadius: "50%", padding: 3, backgroundImage: item.value, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />;
              return null;
            })()}
          </div>
        ) : item.type === "badge" && item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-10 h-10 object-contain z-10" style={{ filter: `drop-shadow(0 0 10px ${glow}88)` }} />
        ) : (
          <div className="relative z-10" style={{ color: glow, filter: `drop-shadow(0 0 12px ${glow}99)`, opacity: 0.7 }}>
            {item.type === "title" && <Crown  size={38} />}
            {item.type === "badge" && <Shield size={38} />}
          </div>
        )}
        <span className="absolute top-1.5 right-1.5 font-inconsolata text-[9px] uppercase px-1.5 py-0.5 rounded-md"
          style={{ background: glow + "22", color: glow, letterSpacing: "0.06em" }}>
          {rMeta?.label ?? "??"}
        </span>
      </div>
      <div className="px-2 pt-2 pb-2.5 flex flex-col gap-1">
        <p className="font-jaro text-[12px] text-zinc-200 leading-tight truncate">{item.name}</p>
        <div className="flex items-center justify-between">
          <span className="font-inconsolata text-[10px] text-zinc-500">+{offer.quantidade} frags</span>
          <span className="inline-flex items-center gap-0.5 font-jaro text-[11px] text-amber-400">
            <CoinIcon size={10} className="inline" />
            {offer.preco.toLocaleString("pt-BR")}
          </span>
        </div>
      </div>
    </button>
  );
}

/* --- Daily offer bottom sheet ------------------------------------------- */
function DailyOfferSheet({
  offer,
  onClose,
  onBuy,
  buying,
}: {
  offer: DailyOffer | null;
  onClose: () => void;
  onBuy: (offer: DailyOffer) => void;
  buying: boolean;
}) {
  if (!offer) return null;

  const item   = offer.item;
  const meta   = TYPE_META[item.type as ItemType] ?? TYPE_META.title;
  const rMeta  = item.raridade ? RARIDADES[item.raridade] : null;
  const accent = rMeta?.cor ?? meta.color;
  const isBanner = item.type === "banner";
  const isFrame  = item.type === "frame";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        variants={backdrop} initial="hidden" animate="visible" exit="exit"
        onClick={onClose}
      />
      <motion.div
        className="relative bg-zinc-950 border-t border-zinc-800 rounded-t-2xl shadow-2xl overflow-y-auto"
        style={{ maxHeight: "72vh" }}
        variants={slideUp} initial="hidden" animate="visible" exit="exit"
      >
        <div className="w-9 h-1 rounded-sm bg-zinc-700 mx-auto mt-3" />
        <div className="flex flex-col gap-4 p-5 pb-20 lg:pb-8">
          <div className="flex items-start justify-between gap-3">
            {isBanner && item.value ? (
              <UserBanner banner={item.value} animated={item.animated} className="flex-1 rounded-2xl" style={{ height: 64 }} />
            ) : isFrame ? (
              <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#3f3f46", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#71717a" }}>👤</div>
                {(() => {
                  const src = item.value?.startsWith("http") ? item.value : item.imageUrl?.startsWith("http") ? item.imageUrl : null;
                  if (src) return <img src={src} alt="" className="absolute pointer-events-none" style={{ top: "50%", left: "50%", width: "136%", height: "136%", maxWidth: "none", transform: "translate(-50%, -50%)", objectFit: "contain" }} />;
                  if (item.value) return <div className="absolute" style={{ inset: -3, borderRadius: "50%", padding: 3, backgroundImage: item.value, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />;
                  return null;
                })()}
              </div>
            ) : item.type === "badge" && item.imageUrl ? (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                style={{ background: accent + "22", boxShadow: `0 0 36px -8px ${accent}` }}>
                <img src={item.imageUrl} alt="" className="w-11 h-11 object-contain" />
              </div>
            ) : item.type === "title" ? (
              <div className="shrink-0 rounded-xl overflow-hidden border border-zinc-800" style={{ width: 170 }}>
                <div className="h-6 bg-gradient-to-r from-zinc-800 to-zinc-900" />
                <div className="px-3 py-1.5 flex items-center gap-2 bg-zinc-900/80">
                  <div className="w-6 h-6 rounded-full bg-zinc-700 shrink-0 grid place-items-center text-[10px] text-zinc-500">👤</div>
                  <span className="font-inconsolata text-[10px] text-zinc-100 truncate">
                    {(() => { try { return JSON.parse(item.value ?? "{}").title } catch { return item.name } })()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl grid place-items-center shrink-0"
                style={{ background: accent + "22", color: accent, boxShadow: `0 0 32px -8px ${accent}` }}>
                {item.type === "badge" && <Shield size={26} />}
                {item.type === "title" && <Crown size={26} />}
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
                <span className="inline-flex items-center gap-1 font-inconsolata uppercase text-[10px] rounded-lg px-2 py-0.5 border"
                  style={{ color: accent, background: accent + "18", borderColor: accent + "40", letterSpacing: "0.08em" }}>
                  <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ background: accent }} />
                  {rMeta.label}
                </span>
              )}
            </div>
            {item.description && (
              <p className="font-inconsolata text-[11px] text-zinc-400 leading-relaxed mt-3">{item.description}</p>
            )}
          </div>

          <div className="border-t border-zinc-800" />

          <div className="space-y-2">
            <div className="flex items-center justify-between font-inconsolata text-xs">
              <span className="text-zinc-500">Fragmentos</span>
              <span style={{ color: accent }}>+{offer.quantidade}</span>
            </div>
            <div className="bg-zinc-900/50 rounded-xl px-4 py-3 border border-zinc-800/50">
              <p className="font-inconsolata text-[11px] text-zinc-500 leading-relaxed">
                🎁 Adquira <strong className="text-zinc-300">{offer.quantidade} fragmentos</strong> de <strong className="text-zinc-300">{item.name}</strong> para acelerar o desbloqueio deste item.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={buying}
            onClick={() => onBuy(offer)}
            className="w-full flex items-center justify-center gap-2 font-inconsolata font-semibold text-sm rounded-xl px-5 py-3.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-[0_0_24px_-6px_rgba(251,191,36,0.5)]"
          >
            {buying ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <><CoinIcon size={16} className="inline" /> Comprar por {offer.preco.toLocaleString("pt-BR")} coins</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* --- Coin confirm modal -------------------------------------------------- */
function CoinConfirmModal({
  pack,
  userDiamonds,
  onClose,
  onConfirm,
  loading,
}: {
  pack: CoinPack;
  userDiamonds: number;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const canAfford = userDiamonds >= pack.price;
  const coinLabel = pack.coins.toLocaleString("pt-BR");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        variants={backdrop} initial="hidden" animate="visible" exit="exit"
        onClick={loading ? undefined : onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d0d10", border: "1px solid rgba(251,191,36,0.25)" }}
        variants={modalBox} initial="hidden" animate="visible" exit="exit"
      >
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />
        <div className="flex flex-col gap-4 px-6 py-7">
          <div className="flex items-center justify-between">
            <p className="font-jaro text-[18px] text-white">Confirmar compra</p>
            <button type="button" onClick={onClose} disabled={loading}
              className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-1 disabled:opacity-40">
              <X size={16} />
            </button>
          </div>

          <div className="bg-zinc-900/60 rounded-xl p-4 flex items-center gap-3"
            style={{ border: "1px solid rgba(251,191,36,0.15)" }}>
            <CoinIcon size={32} className="text-amber-400 shrink-0" />
            <div>
              <p className="font-jaro text-[15px] text-white">{coinLabel} Coins</p>
              <p className="font-inconsolata text-[11px] text-zinc-500">{pack.name}</p>
            </div>
            <div className="ml-auto text-right shrink-0">
              <span className="inline-flex items-center gap-1 font-jaro text-[16px] text-cyan-300">
                <DiamondIcon size={13} /> {pack.price}
              </span>
              <p className="font-inconsolata text-[10px] text-zinc-600">diamantes</p>
            </div>
          </div>

          <div className="flex items-center justify-between font-inconsolata text-xs px-0.5">
            <span className="text-zinc-500">Seu saldo</span>
            <span className={`inline-flex items-center gap-1 ${canAfford ? "text-zinc-400" : "text-rose-400"}`}>
              {userDiamonds.toLocaleString("pt-BR")} <DiamondIcon size={14} />
            </span>
          </div>

          {!canAfford && (
            <div className="bg-rose-500/8 border border-rose-500/20 rounded-xl px-3 py-2.5">
              <p className="font-inconsolata text-xs text-rose-400">
                Diamantes insuficientes para esta compra.
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 font-inconsolata font-semibold text-sm rounded-xl px-4 py-2.5 transition-all cursor-pointer disabled:opacity-40"
              style={{ background: "#18181b", border: "1px solid rgba(113,113,122,0.3)", color: "#a1a1aa" }}>
              Cancelar
            </button>
            <button type="button" onClick={onConfirm} disabled={loading || !canAfford}
              className="flex-1 flex items-center justify-center gap-2 font-inconsolata font-semibold text-sm rounded-xl px-4 py-2.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canAfford ? "#fbbf24" : "#18181b", color: canAfford ? "#09090b" : "#a1a1aa" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Comprar"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* --- Diamond confirm modal ----------------------------------------------- */
function DiamondConfirmModal({
  pack,
  onClose,
  onConfirm,
}: {
  pack: DiamondPack;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        variants={backdrop} initial="hidden" animate="visible" exit="exit"
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d0d10", border: "1px solid rgba(34,211,238,0.25)" }}
        variants={modalBox} initial="hidden" animate="visible" exit="exit"
      >
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, transparent, #22d3ee, transparent)" }} />
        {pack.highlight && (
          <div className="absolute top-0 right-0 m-3">
            <span className="font-inconsolata font-bold uppercase"
              style={{
                fontSize: 8, letterSpacing: "0.08em",
                background: "#22d3ee", color: "#09090b",
                padding: "2px 8px", borderRadius: 4,
              }}>
              MAIS POPULAR
            </span>
          </div>
        )}
        <div className="flex flex-col gap-4 px-6 py-7">
          <div className="flex items-center justify-between">
            <p className="font-jaro text-[18px] text-white">Confirmar compra</p>
            <button type="button" onClick={onClose}
              className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-1">
              <X size={16} />
            </button>
          </div>

          <div className="bg-zinc-900/60 rounded-xl p-4 flex items-center gap-3"
            style={{ border: "1px solid rgba(34,211,238,0.15)" }}>
            <DiamondIcon size={32} className="shrink-0" />
            <div>
              <p className="font-jaro text-[15px] text-white">
                {pack.diamonds.toLocaleString("pt-BR")} Diamantes
              </p>
              <p className="font-inconsolata text-[11px] text-zinc-500">{pack.name}</p>
            </div>
            <div className="ml-auto text-right shrink-0">
              <span className="font-inconsolata font-semibold text-[16px] text-green-400">{pack.brl}</span>
            </div>
          </div>

          <p className="font-inconsolata text-[11px] text-zinc-500 text-center leading-relaxed">
            Você será redirecionado para o Mercado Pago para concluir o pagamento com segurança.
          </p>

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 font-inconsolata font-semibold text-sm rounded-xl px-4 py-2.5 transition-all cursor-pointer"
              style={{ background: "#18181b", border: "1px solid rgba(113,113,122,0.3)", color: "#a1a1aa" }}>
              Cancelar
            </button>
            <button type="button" onClick={onConfirm}
              className="flex-1 font-inconsolata font-semibold text-sm rounded-xl px-4 py-2.5 transition-all cursor-pointer"
              style={{ background: "#22d3ee", color: "#09090b" }}>
              Ir para pagamento
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* --- Checkout redirect overlay ------------------------------------------- */
function CheckoutRedirectOverlay() {
  return (
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
            <p className="font-jaro text-[20px] text-white">Redirecionando...</p>
            <p className="font-inconsolata text-[12px] text-zinc-400 mt-1 leading-relaxed">
              Aguarde enquanto abrimos a página de pagamento segura.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* --- MP return modals ---------------------------------------------------- */
function MPSuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        variants={backdrop} initial="hidden" animate="visible" exit="exit"
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d0d10", border: "1px solid rgba(34,211,238,0.25)" }}
        variants={modalBox} initial="hidden" animate="visible" exit="exit"
      >
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, transparent, #22d3ee, transparent)" }} />
        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <div className="w-16 h-16 rounded-full grid place-items-center"
            style={{ background: "rgba(34,211,238,0.12)", boxShadow: "0 0 32px -8px rgba(34,211,238,0.6)" }}>
            <Check size={32} style={{ color: "#22d3ee" }} />
          </div>
          <div className="text-center">
            <p className="font-jaro text-[22px] text-white leading-tight">Pagamento aprovado!</p>
            <p className="font-inconsolata text-[12px] text-zinc-400 mt-2 leading-relaxed">
              Seus diamantes serão creditados em instantes.<br />Obrigado pela compra!
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-full font-inconsolata font-semibold text-sm rounded-xl px-5 py-3 transition-all cursor-pointer"
            style={{ background: "#22d3ee", color: "#09090b" }}>
            Ótimo!
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MPFailedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        variants={backdrop} initial="hidden" animate="visible" exit="exit"
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d0d10", border: "1px solid rgba(239,68,68,0.25)" }}
        variants={modalBox} initial="hidden" animate="visible" exit="exit"
      >
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, transparent, #ef4444, transparent)" }} />
        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <div className="w-16 h-16 rounded-full grid place-items-center"
            style={{ background: "rgba(239,68,68,0.1)", boxShadow: "0 0 32px -8px rgba(239,68,68,0.5)" }}>
            <AlertTriangle size={32} style={{ color: "#ef4444" }} />
          </div>
          <div className="text-center">
            <p className="font-jaro text-[22px] text-white leading-tight">Pagamento recusado</p>
            <p className="font-inconsolata text-[12px] text-zinc-400 mt-2 leading-relaxed">
              Não foi possível processar o pagamento.<br />Verifique seus dados e tente novamente.
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-full font-inconsolata font-semibold text-sm rounded-xl px-5 py-3 transition-all cursor-pointer"
            style={{ background: "#18181b", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
            Tentar novamente
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MPExpiredModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        variants={backdrop} initial="hidden" animate="visible" exit="exit"
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d0d10", border: "1px solid rgba(113,113,122,0.3)" }}
        variants={modalBox} initial="hidden" animate="visible" exit="exit"
      >
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, transparent, #71717a, transparent)" }} />
        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <div className="w-16 h-16 rounded-full grid place-items-center"
            style={{ background: "rgba(113,113,122,0.1)", boxShadow: "0 0 32px -8px rgba(113,113,122,0.4)" }}>
            <Clock size={32} style={{ color: "#71717a" }} />
          </div>
          <div className="text-center">
            <p className="font-jaro text-[22px] text-white leading-tight">Pix expirado</p>
            <p className="font-inconsolata text-[12px] text-zinc-400 mt-2 leading-relaxed">
              O Pix expirou. Gere um novo se quiser.
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-full font-inconsolata font-semibold text-sm rounded-xl px-5 py-3 transition-all cursor-pointer"
            style={{ background: "#18181b", border: "1px solid rgba(113,113,122,0.3)", color: "#a1a1aa" }}>
            Entendido
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MPPendingModal({ countdown, onCancel }: { countdown: string; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        variants={backdrop} initial="hidden" animate="visible" exit="exit"
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d0d10", border: "1px solid rgba(234,179,8,0.25)" }}
        variants={modalBox} initial="hidden" animate="visible" exit="exit"
      >
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, transparent, #eab308, transparent)" }} />
        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <div className="w-16 h-16 rounded-full grid place-items-center"
            style={{ background: "rgba(234,179,8,0.1)", boxShadow: "0 0 32px -8px rgba(234,179,8,0.5)" }}>
            <Clock size={32} style={{ color: "#eab308" }} />
          </div>
          <div className="text-center">
            <p className="font-jaro text-[22px] text-white leading-tight">Pix gerado!</p>
            <p className="font-inconsolata text-[12px] text-zinc-400 mt-2 leading-relaxed">
              Pague no app do seu banco e seus diamantes serão creditados
              automaticamente em alguns instantes após a confirmação.
            </p>
            <p className="font-inconsolata text-[11px] text-zinc-600 mt-2">
              Aguardando pagamento — expira em{" "}
              <span className="text-amber-500 font-semibold">{countdown}</span>
            </p>
          </div>
          <button type="button" onClick={onCancel}
            className="w-full font-inconsolata font-semibold text-sm rounded-xl px-5 py-3 transition-all cursor-pointer"
            style={{ background: "#18181b", border: "1px solid rgba(234,179,8,0.3)", color: "#eab308" }}>
            Cancelar / Não vou pagar
          </button>
          <p className="font-inconsolata text-[10px] text-zinc-700 text-center -mt-2">
            Tudo bem! Se mudar de ideia, é só comprar novamente.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* --- Page ---------------------------------------------------------------- */
export default function LojaPage() {
  const { token, loadFromStorage } = useAuthStore();
  const { profile, shopItems, loadProfile, loadShopItems, loading } = useProfileStore();
  const { success, error } = useToast();

  const [selected, setSelected]             = useState<ShopItem | null>(null);
  const [buying, setBuying]                 = useState(false);
  const [buyingCoin, setBuyingCoin]         = useState(false);
  const [coinConfirm, setCoinConfirm]       = useState<CoinPack | null>(null);
  const [diamondConfirm, setDiamondConfirm] = useState<DiamondPack | null>(null);
  const [checkingOut, setCheckingOut]       = useState(false);
  const [mpModal, setMpModal]               = useState<"success" | "failed" | "pending" | "expired" | null>(null);
  const [diamondsBefore, setDiamondsBefore] = useState<number>(0);
  const [countdown, setCountdown]           = useState<string>("");

  const [baus, setBaus]                     = useState<any[]>([]);
  const [abrindo, setAbrindo]               = useState<string | null>(null);
  const [resultado, setResultado]           = useState<any>(null);
  const [bauDetalhes, setBauDetalhes]       = useState<any>(null);
  const [dailyOffers, setDailyOffers]       = useState<DailyOffer[]>([]);
  const [dailyOfferSelected, setDailyOfferSelected] = useState<DailyOffer | null>(null);
  const [buyingOffer, setBuyingOffer]       = useState(false);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => {
    if (token) {
      if (!profile) loadProfile();
      if (!shopItems.length) loadShopItems();
    }
  }, [token, profile, shopItems.length, loadProfile, loadShopItems]);

  useEffect(() => {
    getBausApi().then(setBaus).catch(() => setBaus([]));
  }, []);

  useEffect(() => {
    if (token) {
      getDailyOffersApi().then(setDailyOffers).catch(() => setDailyOffers([]));
    }
  }, [token]);

  async function handleAbrirBau(tipo: string) {
    if (abrindo) return;
    setAbrindo(tipo);
    setBauDetalhes(null);
    try {
      const res = await abrirBauApi(tipo);
      setResultado(res);
      loadProfile();
    } catch (err) {
      error(apiErrMsg(err, "Erro ao abrir baú"));
    } finally {
      setAbrindo(null);
    }
  }

  const [coins, setCoins]             = useState<number | null>(null);
  const [diamonds, setDiamonds]       = useState<number | null>(null);
  const userCoins    = coins    ?? profile?.coins    ?? 0;
  const userDiamonds = diamonds ?? profile?.diamonds ?? 0;

  useEffect(() => {
    if (profile) {
      setCoins(profile.coins);
      setDiamonds(profile.diamonds ?? 0);
    }
  }, [profile]);

  useEffect(() => {
    const status = sessionStorage.getItem("mp_payment_status");
    if (!status) return;
    sessionStorage.removeItem("mp_payment_status");

    if (status === "pending") {
      const stored = sessionStorage.getItem("mp_diamonds_before");
      setDiamondsBefore(stored !== null ? parseInt(stored, 10) : 0);
      setMpModal("pending");
    }
  }, []);

  // Contador regressivo do Pix (30 min a partir do checkout)
  useEffect(() => {
    if (mpModal !== "pending") return;

    function calcCountdown() {
      const stored = sessionStorage.getItem("gbCheckoutAt");
      const checkoutAt = stored ? parseInt(stored, 10) : Date.now();
      const expiresAt = checkoutAt + 30 * 60 * 1000;
      const remaining = Math.max(0, expiresAt - Date.now());
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    setCountdown(calcCountdown());
    const tick = setInterval(() => setCountdown(calcCountdown()), 1000);
    return () => clearInterval(tick);
  }, [mpModal]);

  // Polling de saldo após retorno de Pix pendente
  useEffect(() => {
    if (mpModal !== "pending") return;

    const before = diamondsBefore;

    const stopPolling = () => {
      clearInterval(interval);
      clearTimeout(expireTimeout);
      sessionStorage.removeItem("mp_diamonds_before");
      sessionStorage.removeItem("gbCheckoutAt");
    };

    const interval = setInterval(async () => {
      try {
        const { diamonds: current } = await getDiamondBalanceApi();
        if (current > before) {
          stopPolling();
          setDiamonds(current);
          setMpModal("success");
        }
      } catch {
        // ignora erros transientes
      }
    }, 5000);

    // Timeout baseado no tempo real de expiração do Pix (30 min)
    const stored = sessionStorage.getItem("gbCheckoutAt");
    const checkoutAt = stored ? parseInt(stored, 10) : Date.now();
    const msUntilExpiry = Math.max(0, (checkoutAt + 30 * 60 * 1000) - Date.now());

    const expireTimeout = setTimeout(() => {
      stopPolling();
      setMpModal("expired");
    }, msUntilExpiry);

    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpModal]);

  function handleCancelPending() {
    sessionStorage.removeItem("mp_diamonds_before");
    sessionStorage.removeItem("gbCheckoutAt");
    setMpModal(null);
  }

  async function handleCloseMpModal() {
    if (mpModal === "success") {
      try {
        const { diamonds: newBalance } = await getDiamondBalanceApi();
        setDiamonds(newBalance);
      } catch {
        // saldo será atualizado no próximo loadProfile
      }
    }
    setMpModal(null);
  }

  const ownedIds = useMemo(
    () => new Set((profile?.items ?? []).map(i => i.id)),
    [profile?.items]
  );

  const nonFragment = useMemo(
    () => shopItems.filter(i => i.available && !ownedIds.has(i.id) && !i.fragmentavel),
    [shopItems, ownedIds]
  );

  function categoryItems(type: ItemType) {
    return nonFragment.filter(i => i.type === type).sort((a, b) => {
      const wa = raridadeWeight(a.raridade);
      const wb = raridadeWeight(b.raridade);
      return wa !== wb ? wa - wb : a.name.localeCompare(b.name);
    });
  }

  async function handleBuyCosmetic(item: ShopItem) {
    setBuying(true);
    try {
      await buyShopItemApi(item.id);
      setCoins(c => (c ?? 0) - item.price);
      success(`"${item.name}" comprado!`);
      await loadProfile();
      setSelected(null);
    } catch (e) {
      error(apiErrMsg(e, "Erro ao comprar."));
    } finally {
      setBuying(false);
    }
  }

  async function handleBuyCoinPack(pack: CoinPack) {
    if (userDiamonds < pack.price) {
      error(`Você precisa de ${pack.price} diamantes para comprar este pacote.`);
      setCoinConfirm(null);
      return;
    }
    setBuyingCoin(true);
    try {
      await buyCoinsWithDiamondsApi(pack.id);
      setDiamonds(d => (d ?? 0) - pack.price);
      setCoins(c => (c ?? 0) + pack.coins);
      success(`+${pack.coins.toLocaleString("pt-BR")} coins adicionados!`);
      setCoinConfirm(null);
    } catch (e) {
      error(apiErrMsg(e, "Erro ao comprar coins."));
    } finally {
      setBuyingCoin(false);
    }
  }

  async function handleBuyDiamondPack(pack: DiamondPack) {
    setDiamondConfirm(null);
    setCheckingOut(true);
    try {
      const packageId = parseInt(pack.id.replace("d", ""), 10);
      const [{ checkoutUrl, sandboxUrl }, { diamonds: freshBalance }] = await Promise.all([
        startDiamondCheckoutApi(packageId),
        getDiamondBalanceApi(),
      ]);
      const url = process.env.NODE_ENV === "production" ? checkoutUrl : sandboxUrl;
      if (!url) throw new Error("URL de checkout não disponível");
      sessionStorage.setItem("mp_payment_status", "pending");
      sessionStorage.setItem("mp_diamonds_before", String(freshBalance));
      sessionStorage.setItem("gbCheckoutAt", String(Date.now()));
      window.location.href = url;
    } catch (e) {
      setCheckingOut(false);
      error(apiErrMsg(e, "Erro ao iniciar compra."));
    }
  }

  async function handleBuyDailyOffer(offer: DailyOffer) {
    setBuyingOffer(true);
    try {
      const res = await buyDailyOfferApi(offer.id);
      setCoins(c => (c ?? 0) - offer.preco);
      success(res.message);
      setDailyOffers(prev => prev.filter(o => o.id !== offer.id));
      setDailyOfferSelected(null);
      loadProfile();
    } catch (e) {
      error(apiErrMsg(e, "Erro ao comprar oferta."));
    } finally {
      setBuyingOffer(false);
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

      {/* Ofertas do Dia — primeiro */}
      {dailyOffers.length > 0 && (
        <section className="mb-10">
          <SectionHeader label="Ofertas do Dia" icon={Sparkles} color="#fbbf24" sub={`${dailyOffers.length} ofertas`} />
          <p className="font-inconsolata text-[11px] text-zinc-500 mb-3">
            Ofertas limitadas — fragmentos de itens exclusivos por tempo limitado!
          </p>
          <Grid3>
            {dailyOffers.map(o => (
              <DailyOfferCard key={o.id} offer={o} onSelect={setDailyOfferSelected} />
            ))}
          </Grid3>
        </section>
      )}

      {/* Títulos */}
      {(() => {
        const items = categoryItems("title");
        if (!items.length) return null;
        return (
          <section className="mb-10">
            <SectionHeader label="Títulos" icon={Crown} color="#f59e0b" sub={`${items.length} disponíveis`} />
            <Grid3>
              {items.map(i => <CosmeticCard key={i.id} item={i} onSelect={setSelected} />)}
            </Grid3>
          </section>
        );
      })()}

      {/* Emblemas */}
      {(() => {
        const items = categoryItems("badge");
        if (!items.length) return null;
        return (
          <section className="mb-10">
            <SectionHeader label="Emblemas" icon={Shield} color="#a78bfa" sub={`${items.length} disponíveis`} />
            <Grid3>
              {items.map(i => <CosmeticCard key={i.id} item={i} onSelect={setSelected} />)}
            </Grid3>
          </section>
        );
      })()}

      {/* Banners */}
      {(() => {
        const items = categoryItems("banner");
        if (!items.length) return null;
        return (
          <section className="mb-10">
            <SectionHeader label="Banners" icon={ImageIcon} color="#38bdf8" sub={`${items.length} disponíveis`} />
            <Grid3>
              {items.map(i => <CosmeticCard key={i.id} item={i} onSelect={setSelected} />)}
            </Grid3>
          </section>
        );
      })()}

      {/* Molduras */}
      {(() => {
        const items = categoryItems("frame");
        if (!items.length) return null;
        return (
          <section className="mb-10">
            <SectionHeader label="Molduras" icon={ImageIcon} color="#22d3ee" sub={`${items.length} disponíveis`} />
            <Grid3>
              {items.map(i => <CosmeticCard key={i.id} item={i} onSelect={setSelected} />)}
            </Grid3>
          </section>
        );
      })()}

      {/* Baús */}
      {baus.length > 0 && (
        <section className="mb-10">
          <SectionHeader label="Baús" icon={Sparkles} color="#a78bfa" />
          <p className="font-inconsolata text-[11px] text-zinc-500 mb-3">
            Abra baús para ganhar Coins e fragmentos de itens exclusivos
          </p>
          <Grid3>
            {baus.map(bau => (
              <BauCard
                key={bau.tipo}
                bau={bau}
                onAbrir={setBauDetalhes}
              />
            ))}
          </Grid3>
        </section>
      )}

      {/* Coins */}
      <section className="mb-10">
        <SectionHeader label="Coins" icon={Coins} color="#fbbf24" sub={`seu saldo: ${userCoins.toLocaleString("pt-BR")}`} />
        <p className="font-inconsolata text-[11px] text-zinc-600 mb-3">
          Compre coins com seus <DiamondIcon size={12} className="inline align-middle" /> Diamantes.
        </p>
        <Grid3>
          {COIN_PACKS.map(p => (
            <CoinPackCard key={p.id} pack={p} onBuy={setCoinConfirm} />
          ))}
        </Grid3>
      </section>

      {/* Diamantes */}
      <section className="mb-10">
        <SectionHeader label="Diamantes" icon={Sparkles} color="#22d3ee" sub={`seu saldo: ${userDiamonds}`} />
        <p className="font-inconsolata text-[11px] text-zinc-600 mb-3">
          Diamantes são a moeda premium do GameBank. Compra 100% segura.
        </p>
        <Grid3>
          {DIAMOND_PACKS.map(p => (
            <DiamondPackCard key={p.id} pack={p} onBuy={setDiamondConfirm} />
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

      <AnimatePresence>
        {dailyOfferSelected && (
          <DailyOfferSheet
            offer={dailyOfferSelected}
            onClose={() => setDailyOfferSelected(null)}
            onBuy={handleBuyDailyOffer}
            buying={buyingOffer}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {coinConfirm && (
          <CoinConfirmModal
            pack={coinConfirm}
            userDiamonds={userDiamonds}
            onClose={() => setCoinConfirm(null)}
            onConfirm={() => handleBuyCoinPack(coinConfirm)}
            loading={buyingCoin}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {diamondConfirm && (
          <DiamondConfirmModal
            pack={diamondConfirm}
            onClose={() => setDiamondConfirm(null)}
            onConfirm={() => handleBuyDiamondPack(diamondConfirm)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkingOut && <CheckoutRedirectOverlay />}
      </AnimatePresence>

      <AnimatePresence>
        {mpModal === "success"  && <MPSuccessModal  onClose={handleCloseMpModal} />}
        {mpModal === "failed"   && <MPFailedModal   onClose={handleCloseMpModal} />}
        {mpModal === "expired"  && <MPExpiredModal  onClose={handleCloseMpModal} />}
        {mpModal === "pending"  && <MPPendingModal  countdown={countdown} onCancel={handleCancelPending} />}
      </AnimatePresence>

      <BauDetailModal
        bau={bauDetalhes}
        onClose={() => setBauDetalhes(null)}
        onAbrir={handleAbrirBau}
        abrindo={abrindo !== null}
      />

      <BauAbertura
        resultado={resultado}
        onClose={() => setResultado(null)}
      />
    </div>
  );
}
