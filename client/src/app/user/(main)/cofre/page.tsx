/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, staggerItem, backdrop, slideUp, shimmerTitleStyle } from "@/lib/animations";
import { Loader2, Crown, Shield, Image as ImageIcon, Sparkles, Check, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { equipShopItemApi } from "@/services/api/shop";
import { useToast } from "@/components/Toast";
import UserBanner from "@/components/UserBanner";
import { Chip } from "@/components/user/UserUI";
import { RARITY_META } from "@/constants/rarity";
import type { UserItem } from "@/types/shop";

type ItemType     = "title" | "badge" | "banner" | "frame";
type CategoryKey  = "equipados" | ItemType;

const TYPE_META: Record<ItemType, { label: string; navLabel: string; color: string; tone: "amber" | "violet" | "sky" | "cyan" }> = {
  title:  { label: "Título",  navLabel: "Títulos",  color: "#f59e0b", tone: "amber"  },
  badge:  { label: "Emblema", navLabel: "Emblemas", color: "#a78bfa", tone: "violet" },
  banner: { label: "Banner",  navLabel: "Banners",  color: "#38bdf8", tone: "sky"    },
  frame:  { label: "Moldura", navLabel: "Molduras", color: "#22d3ee", tone: "cyan"   },
};

const NAV_KEYS: { key: CategoryKey; label: string }[] = [
  { key: "equipados", label: "Equipados" },
  { key: "title",  label: "Títulos"  },
  { key: "badge",  label: "Emblemas" },
  { key: "banner", label: "Banners"  },
  { key: "frame",  label: "Molduras" },
];

function VaultItemCard({
  item,
  isSelected,
  onSelect,
}: {
  item: UserItem;
  isSelected: boolean;
  onSelect: (item: UserItem) => void;
}) {
  const meta      = TYPE_META[item.type as ItemType] ?? TYPE_META.title;
  const rMeta     = item.rarity ? RARITY_META[item.rarity] : null;
  const glowColor = rMeta?.color ?? "#d4d4d8";
  const isBanner  = item.type === "banner";
  const isFrame   = item.type === "frame";
  const topBg     = isBanner && item.value
    ? item.value
    : `radial-gradient(ellipse at 50% 55%, ${glowColor}2e 0%, #0d0d10 68%)`;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex flex-col overflow-hidden w-full cursor-pointer outline-none transition-all"
      style={{
        borderRadius: 14,
        border: item.equipped
          ? "1.5px solid rgba(74,222,128,0.65)"
          : isSelected
            ? "1px solid rgba(74,222,128,0.4)"
            : `1px solid ${glowColor}30`,
        boxShadow: item.equipped
          ? "0 0 22px -6px rgba(74,222,128,0.45)"
          : isSelected
            ? "0 0 20px -8px rgba(74,222,128,0.3)"
            : (rMeta && rMeta.color !== "#d4d4d8" ? `0 0 14px -9px ${glowColor}88` : "none"),
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
        {item.equipped && (
          <div
            className="absolute top-1.5 right-1.5 rounded-full grid place-items-center"
            style={{ width: 18, height: 18, background: "rgba(74,222,128,0.92)" }}
          >
            <Check size={10} color="#09090b" strokeWidth={3} />
          </div>
        )}
        {isBanner ? null : isFrame ? (
          <div className="relative" style={{ width: 44, height: 44, margin: "0 auto" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#3f3f46", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, color: "#71717a" }}>
              👤
            </div>
            {(() => {
              const src = item.value?.startsWith("http") ? item.value : item.imageUrl?.startsWith("http") ? item.imageUrl : null;
              if (src) {
                return <img src={src} alt="" className="absolute pointer-events-none" style={{ top: "50%", left: "50%", width: "136%", height: "136%", maxWidth: "none", transform: "translate(-50%, -50%)", objectFit: "contain" }} />
              }
              if (item.value) {
                return <div className="absolute" style={{ inset: -3, borderRadius: "50%", padding: 3, backgroundImage: item.value, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />
              }
              return null;
            })()}
          </div>
        ) : (
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
          background: item.equipped ? "rgba(74,222,128,0.05)" : "#111113",
          borderTop: `1px solid ${item.equipped ? "rgba(74,222,128,0.2)" : glowColor + "28"}`,
        }}
      >
        <p className="font-jaro text-[13px] text-zinc-100 leading-tight mb-1">{item.name}</p>
        <span
          className="font-inconsolata uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.08em",
            color: item.equipped ? "#4ade80" : "#3f3f46",
          }}
        >
          {item.equipped ? "● equipado" : "não equipado"}
        </span>
      </div>
    </button>
  );
}

function DetailPanel({
  item,
  onClose,
  onEquip,
  equipping,
}: {
  item: UserItem | null;
  onClose: () => void;
  onEquip: (item: UserItem) => void;
  equipping: boolean;
}) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-7 opacity-40">
        <Sparkles size={40} color="#27272a" />
        <p className="font-inconsolata text-[11px] text-zinc-700 text-center leading-relaxed">
          Selecione um item<br />para ver detalhes
        </p>
      </div>
    );
  }

  const meta      = TYPE_META[item.type as ItemType] ?? TYPE_META.title;
  const rMeta     = item.rarity ? RARITY_META[item.rarity] : null;
  const glowColor = rMeta?.color ?? "#d4d4d8";
  const isBanner  = item.type === "banner";
  const isFrame   = item.type === "frame";

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto h-full">
      <div className="flex items-start justify-between gap-2.5">
        {isBanner && item.value ? (
          <UserBanner
            banner={item.value}
            imageUrl={item.imageUrl}
            animated={item.animated}
            className="flex-1 rounded-2xl"
            style={{ height: 72 }}
          />
        ) : isFrame ? (
          <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#3f3f46", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#71717a" }}>
              👤
            </div>
            {(() => {
              const src = item.value?.startsWith("http") ? item.value : item.imageUrl?.startsWith("http") ? item.imageUrl : null;
              if (src) {
                return <img src={src} alt="" className="absolute pointer-events-none" style={{ top: "50%", left: "50%", width: "136%", height: "136%", maxWidth: "none", transform: "translate(-50%, -50%)", objectFit: "contain" }} />
              }
              if (item.value) {
                return <div className="absolute" style={{ inset: -3, borderRadius: "50%", padding: 3, backgroundImage: item.value, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />
              }
              return null;
            })()}
          </div>
        ) : item.type === "badge" && item.imageUrl ? (
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{
              background: glowColor + "22",
              boxShadow: `0 0 36px -8px ${glowColor}`,
            }}
          >
            <img src={item.imageUrl} alt="" className="w-11 h-11 object-contain" />
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
                  {item.animated ? (
                    <span className="inline-block font-inconsolata text-[10px] px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10" style={shimmerTitleStyle}>
                      {item.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg border font-inconsolata text-[10px] uppercase tracking-wider whitespace-nowrap bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                      {item.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
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
            {item.type === "badge"  && <Shield size={28} />}
            {item.type === "banner" && <ImageIcon size={28} />}
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
        <span className="font-inconsolata text-xs text-zinc-500">Status</span>
        {item.equipped ? (
          <span className="inline-flex items-center gap-1.5 font-inconsolata text-[11px] text-green-400">
            <span className="w-[7px] h-[7px] rounded-full bg-green-400 inline-block" />
            Equipado
          </span>
        ) : (
          <span className="font-inconsolata text-xs text-zinc-600">Não equipado</span>
        )}
      </div>

      <button
        type="button"
        disabled={equipping}
        onClick={() => onEquip(item)}
        className={`w-full flex items-center justify-center gap-2 font-inconsolata font-semibold text-sm rounded-xl px-5 py-3 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          item.equipped
            ? "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
            : "bg-green-500 text-zinc-950 hover:bg-green-400 shadow-[0_0_20px_-6px_rgba(74,222,128,0.6)]"
        }`}
      >
        {equipping ? (
          <Loader2 size={16} className="animate-spin" />
        ) : item.equipped ? (
          <><X size={16} />Remover equipamento</>
        ) : (
          <><Check size={16} />Equipar agora</>
        )}
      </button>
    </div>
  );
}

export default function CofrePage() {
  const { token, loadFromStorage } = useAuthStore();
  const { profile, loadProfile, loading } = useProfileStore();
  const { success, error } = useToast();

  const [cat, setCat]             = useState<CategoryKey>("equipados");
  const [selected, setSelected]   = useState<UserItem | null>(null);
  const [equipping, setEquipping] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
  useEffect(() => {
    if (token && !profile) loadProfile();
  }, [token, profile, loadProfile]);

  const items: UserItem[] = useMemo(() => profile?.items ?? [], [profile]);

  const counts = useMemo(() => ({
    equipados: items.filter(i => i.equipped).length,
    title:  items.filter(i => i.type === "title").length,
    badge:  items.filter(i => i.type === "badge").length,
    banner: items.filter(i => i.type === "banner").length,
    frame:  items.filter(i => i.type === "frame").length,
  }), [items]);

  const list = useMemo(
    () => cat === "equipados" ? items.filter(i => i.equipped) : items.filter(i => i.type === cat),
    [cat, items]
  );

  const equippedCount = items.filter(i => i.equipped).length;

  function handleSelect(item: UserItem) {
    setSelected(item);
    setMobileSheet(true);
  }

  function handleCatChange(key: CategoryKey) {
    setCat(key);
    setSelected(null);
  }

  async function handleEquip(item: UserItem) {
    setEquipping(true);
    try {
      await equipShopItemApi(item.id);
      const wasEquipped = item.equipped;
      success(wasEquipped ? `"${item.name}" desequipado.` : `"${item.name}" equipado!`);
      await loadProfile();
      setSelected(s => s?.id === item.id ? { ...s, equipped: !wasEquipped } : s);
    } catch {
      error("Erro ao equipar item.");
    } finally {
      setEquipping(false);
    }
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-inconsolata text-sm text-zinc-500">
        Faça login para ver seu cofre.
      </div>
    );
  }

  if (loading.profile || !profile) {
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
          Nenhum item nessa categoria.
        </p>
      </div>
    ) : (
      <motion.div
        className="grid gap-2.5"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))",
          alignItems: "start",
        }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {list.map(item => (
          <motion.div key={item.id} variants={staggerItem}>
            <VaultItemCard
              item={item}
              isSelected={selected?.id === item.id}
              onSelect={handleSelect}
            />
          </motion.div>
        ))}
      </motion.div>
    );

  return (
    <div className="px-4 py-6 pt-16 lg:pt-6 relative">

      {/* ── Desktop: sidebar + grid + detail ── */}
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
                  className="w-full flex items-center justify-between px-4 py-2.5 gap-2 cursor-pointer transition-all"
                  style={{
                    background: active ? "rgba(74,222,128,0.06)" : "transparent",
                    borderLeft: `2px solid ${active ? "#4ade80" : "transparent"}`,
                    color: active ? "#f4f4f5" : "#71717a",
                    outline: "none",
                  }}
                >
                  <span className="font-inconsolata text-[13px]">{label}</span>
                  <span
                    className="font-inconsolata rounded-md px-1.5"
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
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

          {/* Summary widget */}
          <div className="border-t border-zinc-800 p-4">
            <p className="font-inconsolata text-zinc-600 uppercase mb-2"
               style={{ fontSize: 10, letterSpacing: "0.1em" }}>
              Resumo
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="font-inconsolata text-zinc-500 text-[11px]">Itens</span>
                <span className="font-jaro text-zinc-200 text-base">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-inconsolata text-zinc-500 text-[11px]">Equipados</span>
                <span className="font-jaro text-green-400 text-base">{equippedCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Item grid */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 530 }}>
          <ItemGrid />
        </div>

        {/* Detail panel */}
        <div className="border-l border-zinc-800">
          <DetailPanel
            item={selected}
            onClose={() => setSelected(null)}
            onEquip={handleEquip}
            equipping={equipping}
          />
        </div>
      </div>

      {/* ── Mobile: chips + grid ── */}
      <div className="lg:hidden flex flex-col gap-3.5">
        {/* Category chips */}
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
                <span
                  style={{
                    background: active ? "rgba(74,222,128,0.2)" : "#27272a",
                    color: active ? "#4ade80" : "#52525b",
                    borderRadius: 5,
                    padding: "0 5px",
                    fontSize: 10,
                  }}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Summary bar */}
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5">
          <span className="font-inconsolata text-xs text-zinc-500">
            {items.length} itens no cofre
          </span>
          <span className="font-inconsolata text-[11px] text-green-400">
            {equippedCount} equipado{equippedCount !== 1 ? "s" : ""}
          </span>
        </div>

        <ItemGrid />
      </div>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {mobileSheet && selected && (
          <div className="lg:hidden fixed inset-0 z-[200] flex flex-col justify-end">
            <motion.div
              variants={backdrop}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileSheet(false)}
            />
            <motion.div
              variants={slideUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative bg-zinc-950 border-t border-zinc-800 rounded-t-2xl shadow-2xl max-h-[78vh] overflow-y-auto"
            >
              <div className="w-9 h-1 rounded-sm bg-zinc-700 mx-auto mt-3 mb-1" />
              <DetailPanel
                item={selected}
                onClose={() => { setMobileSheet(false); setSelected(null); }}
                onEquip={handleEquip}
                equipping={equipping}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
