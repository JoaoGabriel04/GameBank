'use client';

import { useEffect, useState, useMemo } from "react";
import {
  Loader2, Crown, Shield, Image, Sparkles, Check, X, Ban,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { buyShopItemApi } from "@/services/api/shop";
import { useToast } from "@/components/Toast";
import UserBanner from "@/components/UserBanner";
import CoinIcon from "@/components/CoinIcon";
import { Chip } from "@/components/user/UserUI";
import { RARITY_META } from "@/constants/rarity";
import type { ShopItem } from "@/types/shop";

type ItemType    = "title" | "badge" | "banner";
type CategoryKey = "todos" | ItemType;

const TYPE_META: Record<ItemType, { label: string; color: string; tone: "amber" | "violet" | "sky" }> = {
  title:  { label: "Título",  color: "#f59e0b", tone: "amber"  },
  badge:  { label: "Emblema", color: "#a78bfa", tone: "violet" },
  banner: { label: "Banner",  color: "#38bdf8", tone: "sky"    },
};

const NAV_KEYS: { key: CategoryKey; label: string }[] = [
  { key: "todos",  label: "Todos"    },
  { key: "title",  label: "Títulos"  },
  { key: "badge",  label: "Emblemas" },
  { key: "banner", label: "Banners"  },
];

function ShopItemCard({
  item,
  isSelected,
  onSelect,
}: {
  item: ShopItem;
  isSelected: boolean;
  onSelect: (item: ShopItem) => void;
}) {
  const meta      = TYPE_META[item.type as ItemType] ?? TYPE_META.title;
  const rMeta     = item.rarity ? RARITY_META[item.rarity] : null;
  const glowColor = rMeta?.color ?? meta.color;
  const isBanner  = item.type === "banner";

  const topBg = isBanner && item.value
    ? item.value
    : `radial-gradient(ellipse at 50% 55%, ${glowColor}2e 0%, #0d0d10 68%)`;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex flex-col overflow-hidden w-full cursor-pointer outline-none transition-all"
      style={{
        borderRadius: 14,
        border: isSelected
          ? "1px solid rgba(74,222,128,0.5)"
          : `1px solid ${glowColor}30`,
        boxShadow: isSelected
          ? "0 0 22px -6px rgba(74,222,128,0.5)"
          : (rMeta && rMeta.color !== "#a1a1aa" ? `0 0 14px -9px ${glowColor}88` : "none"),
      }}
    >
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{ height: 104, background: isBanner ? undefined : topBg }}
      >
        {isBanner && (
          <UserBanner banner={item.value} imageUrl={item.imageUrl} className="absolute inset-0 w-full h-full" />
        )}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
            opacity: 0.9,
          }}
        />
        {isSelected && (
          <div
            className="absolute top-1.5 right-1.5 rounded-full grid place-items-center"
            style={{ width: 18, height: 18, background: "rgba(74,222,128,0.9)" }}
          >
            <Check size={10} color="#09090b" strokeWidth={3} />
          </div>
        )}
        {isBanner ? null : (
          <div className="relative z-10" style={{ color: glowColor, filter: `drop-shadow(0 0 14px ${glowColor}99)` }}>
            {item.type === "title"  && <Crown  size={44} />}
            {item.type === "badge"  && (item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="w-11 h-11 object-contain" />
            ) : (
              <Shield size={44} />
            ))}
          </div>
        )}
        <span
          className="absolute bottom-1.5 left-2 font-inconsolata uppercase"
          style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}
        >
          {meta.label}
        </span>
      </div>

      <div
        className="px-2.5 pt-2.5 pb-3"
        style={{
          background: "#111113",
          borderTop: `1px solid ${glowColor}28`,
        }}
      >
        <p className="font-jaro text-[13px] text-zinc-100 leading-tight mb-1.5">{item.name}</p>
        <span className="inline-flex items-center gap-1 font-jaro text-[13px] text-amber-300">
          <CoinIcon size={11} className="text-amber-400" />
          {item.price.toLocaleString("pt-BR")}
        </span>
      </div>
    </button>
  );
}

function DetailPanel({
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
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-7 opacity-40">
        <Sparkles size={40} color="#27272a" />
        <p className="font-inconsolata text-[11px] text-zinc-700 text-center leading-relaxed">
          Selecione um item<br />para ver os detalhes
        </p>
      </div>
    );
  }

  const meta      = TYPE_META[item.type as ItemType] ?? TYPE_META.title;
  const rMeta     = item.rarity ? RARITY_META[item.rarity] : null;
  const glowColor = rMeta?.color ?? meta.color;
  const isBanner  = item.type === "banner";
  const canAfford = userCoins >= item.price;

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto h-full">
      <div className="flex items-start justify-between gap-2.5">
        {isBanner && item.value ? (
          <UserBanner
            banner={item.value}
            imageUrl={item.imageUrl}
            spriteId={null}
            className="flex-1 rounded-2xl"
            style={{ height: 72 }}
          />
        ) : item.type === "badge" && item.imageUrl ? (
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{
              background: glowColor + "22",
              boxShadow: `0 0 36px -8px ${glowColor}`,
            }}
          >
            <img src={item.imageUrl} alt="" className="w-11 h-11 object-contain" />
          </div>
        ) : (
          <div
            className="w-16 h-16 rounded-2xl grid place-items-center shrink-0"
            style={{
              background: glowColor + "22",
              color: glowColor,
              boxShadow: `0 0 36px -8px ${glowColor}`,
            }}
          >
            {item.type === "title"  && <Crown  size={28} />}
            {item.type === "badge"  && <Shield size={28} />}
            {item.type === "banner" && <Image  size={28} />}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-1 shrink-0"
        >
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
              style={{
                color: rMeta.color,
                background: rMeta.color + "18",
                borderColor: rMeta.color + "40",
                letterSpacing: "0.08em",
              }}
            >
              <span className="rounded-full inline-block" style={{ width: 5, height: 5, background: rMeta.color }} />
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
            Faltam <strong>{(item.price - userCoins).toLocaleString("pt-BR")}</strong> coins.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={buying || !canAfford}
        onClick={() => onBuy(item)}
        className={`w-full flex items-center justify-center gap-2 font-inconsolata font-semibold text-sm rounded-xl px-5 py-3 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          canAfford
            ? "bg-green-500 text-zinc-950 hover:bg-green-400 shadow-[0_0_20px_-6px_rgba(74,222,128,0.6)]"
            : "border border-zinc-700 text-zinc-500"
        }`}
      >
        {buying ? (
          <Loader2 size={16} className="animate-spin" />
        ) : canAfford ? (
          <><CoinIcon size={16} />Comprar agora</>
        ) : (
          <><Ban size={16} />Coins insuficientes</>
        )}
      </button>

      {canAfford && (
        <p className="font-inconsolata text-[10px] text-zinc-600 text-center">
          Saldo após: <span className="text-zinc-500">{(userCoins - item.price).toLocaleString("pt-BR")} coins</span>
        </p>
      )}
    </div>
  );
}

export default function LojaCosmeticosPage() {
  const { token, loadFromStorage } = useAuthStore();
  const { profile, shopItems, loadProfile, loadShopItems, loading } = useProfileStore();
  const { success, error } = useToast();

  const [cat, setCat]             = useState<CategoryKey>("todos");
  const [selected, setSelected]   = useState<ShopItem | null>(null);
  const [buying, setBuying]       = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => {
    if (token) {
      if (!profile) loadProfile();
      if (!shopItems.length) loadShopItems();
    }
  }, [token, profile, shopItems.length, loadProfile, loadShopItems]);

  const ownedIds = useMemo(
    () => new Set((profile?.items ?? []).map(i => i.id)),
    [profile?.items]
  );

  const available = useMemo(
    () => shopItems.filter(i => i.available && !ownedIds.has(i.id)),
    [shopItems, ownedIds]
  );

  const counts = useMemo(() => ({
    todos:  available.length,
    title:  available.filter(i => i.type === "title").length,
    badge:  available.filter(i => i.type === "badge").length,
    banner: available.filter(i => i.type === "banner").length,
  }), [available]);

  const list = useMemo(
    () => cat === "todos" ? available : available.filter(i => i.type === cat),
    [cat, available]
  );

  const userCoins = profile?.coins ?? 0;

  function handleSelect(item: ShopItem) { setSelected(item); setMobileSheet(true); }
  function handleCatChange(key: CategoryKey) { setCat(key); setSelected(null); }

  async function handleBuy(item: ShopItem) {
    setBuying(true);
    try {
      await buyShopItemApi(item.id);
      success(`"${item.name}" comprado!`);
      await loadProfile();
      setSelected(null);
      setMobileSheet(false);
    } catch (e: any) {
      error(e?.response?.data?.message ?? "Erro ao comprar item.");
    } finally {
      setBuying(false);
    }
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-inconsolata text-sm text-zinc-500">
        Faça login para acessar a loja.
      </div>
    );
  }

  if (loading.shop || loading.profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  const ItemGrid = () =>
    list.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-[200px] gap-2.5">
        <Sparkles size={32} color="#3f3f46" />
        <p className="font-inconsolata text-sm text-zinc-600">
          Nenhum item disponível nessa categoria.
        </p>
      </div>
    ) : (
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", alignItems: "start" }}
      >
        {list.map(item => (
          <ShopItemCard
            key={item.id}
            item={item}
            isSelected={selected?.id === item.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pt-16 lg:pt-6 relative">

      {/* ── Desktop ── */}
      <div
        className="hidden lg:grid"
        style={{
          gridTemplateColumns: "168px 1fr 264px",
          background: "#111113",
          border: "1px solid #27272a",
          borderRadius: 16,
          overflow: "hidden",
          minHeight: 530,
        }}
      >
        {/* Sidebar */}
        <div className="border-r border-zinc-800 flex flex-col">
          <div className="pt-5 pb-2">
            <p className="font-inconsolata text-zinc-600 uppercase px-4 mb-2.5"
               style={{ fontSize: 10, letterSpacing: "0.15em" }}>
              Categorias
            </p>
            {NAV_KEYS.map(({ key, label }) => {
              const active = cat === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleCatChange(key)}
                  className="w-full flex items-center justify-between px-4 py-2.5 gap-2 cursor-pointer transition-all outline-none"
                  style={{
                    background: active ? "rgba(74,222,128,0.06)" : "transparent",
                    borderLeft: `2px solid ${active ? "#4ade80" : "transparent"}`,
                    color: active ? "#f4f4f5" : "#71717a",
                  }}
                >
                  <span className="font-inconsolata text-[13px]">{label}</span>
                  <span
                    className="font-inconsolata rounded-md"
                    style={{
                      fontSize: 10, padding: "1px 6px",
                      background: active ? "rgba(74,222,128,0.15)" : "#27272a",
                      color: active ? "#4ade80" : "#52525b",
                    }}
                  >
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Balance */}
          <div className="border-t border-zinc-800 p-4">
            <p className="font-inconsolata text-zinc-600 uppercase mb-1"
               style={{ fontSize: 10, letterSpacing: "0.1em" }}>
              Seu saldo
            </p>
            <div className="flex items-center gap-1.5">
              <CoinIcon size={16} className="text-amber-400" />
              <span className="font-jaro text-xl text-amber-300">
                {userCoins.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 530 }}>
          <ItemGrid />
        </div>

        {/* Detail */}
        <div className="border-l border-zinc-800">
          <DetailPanel
            item={selected}
            userCoins={userCoins}
            onClose={() => setSelected(null)}
            onBuy={handleBuy}
            buying={buying}
          />
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="lg:hidden flex flex-col gap-3.5">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {NAV_KEYS.map(({ key, label }) => {
            const active = cat === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleCatChange(key)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 shrink-0 cursor-pointer font-inconsolata text-xs whitespace-nowrap rounded-[10px]"
                style={{
                  background: active ? "rgba(74,222,128,0.1)" : "#18181b",
                  border: `1px solid ${active ? "rgba(74,222,128,0.35)" : "#27272a"}`,
                  color: active ? "#4ade80" : "#71717a",
                }}
              >
                {label}
                <span style={{ background: active ? "rgba(74,222,128,0.2)" : "#27272a", color: active ? "#4ade80" : "#52525b", borderRadius: 5, padding: "0 5px", fontSize: 10 }}>
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5">
          <span className="font-inconsolata text-xs text-zinc-500">Saldo disponível</span>
          <span className="inline-flex items-center gap-1.5 font-jaro text-lg text-amber-300">
            <CoinIcon size={15} className="text-amber-400" />
            {userCoins.toLocaleString("pt-BR")}
          </span>
        </div>

        <ItemGrid />
      </div>

      {/* Mobile bottom sheet */}
      {mobileSheet && selected && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileSheet(false)} />
          <div className="relative bg-zinc-950 border-t border-zinc-800 rounded-t-2xl shadow-2xl max-h-[78vh] overflow-y-auto">
            <div className="w-9 h-1 rounded-sm bg-zinc-700 mx-auto mt-3 mb-1" />
            <DetailPanel
              item={selected}
              userCoins={userCoins}
              onClose={() => { setMobileSheet(false); setSelected(null); }}
              onBuy={handleBuy}
              buying={buying}
            />
          </div>
        </div>
      )}
    </div>
  );
}
