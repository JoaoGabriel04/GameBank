/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import {
  Store, Plus, Pencil, Trash2, Check, X, Crown, Trophy,
  TrendingUp, Target, Palette, Sparkles, Coins, Shield, Image as ImageIcon,
} from "lucide-react";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import { resolveBannerBackground } from "@/constants/banners";
import { RARIDADES, FRAGMENTOS_SUGERIDOS } from "@/constants/raridade";
import CoinIcon from "@/components/CoinIcon";
import UserBanner from "@/components/UserBanner";
import type { AdminShopItem, Banner as ApiBanner, Frame as ApiFrame, Badge as ApiBadge, ItemInput } from "@/services/api/admin";
import {
  Chip, Toggle, Segmented, Btn, Field,
  AdminInput, AdminTextarea, AdminSelect, AdminModal,
} from "@/components/admin/AdminUI";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  crown: Crown, trophy: Trophy, trending: TrendingUp, target: Target,
  palette: Palette, sparkles: Sparkles, coins: Coins, shield: Shield,
  image: ImageIcon,
};

function ItemIcon({ name, size = 20 }: { name: string | null; size?: number }) {
  const I = ICON_MAP[name ?? "sparkles"] ?? Sparkles;
  return <I size={size} />;
}

type ItemType = "title" | "badge" | "banner" | "frame";

const TYPE_META: Record<ItemType, { label: string; tone: "amber" | "violet" | "emerald" | "cyan" }> = {
  title:  { label: "Título",  tone: "amber"   },
  badge:  { label: "Emblema", tone: "violet"  },
  banner: { label: "Banner",  tone: "emerald" },
  frame:  { label: "Moldura", tone: "cyan"    },
};

function getTypeMeta(type: string) {
  return TYPE_META[type as ItemType] ?? TYPE_META.title;
}

function ItemCard({
  item,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: AdminShopItem;
  onEdit: (i: AdminShopItem) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const meta = getTypeMeta(item.type);
  const isBanner = item.type === "banner";
  const isFrame = item.type === "frame";
  const rMeta = item.raridade && RARIDADES[item.raridade] ? RARIDADES[item.raridade] : null;
  const glowColor = rMeta?.cor ?? "#52525b";
  const topBg = !isBanner
    ? `radial-gradient(ellipse at 50% 60%, ${glowColor}2e 0%, #0d0d10 70%)`
    : undefined;

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden transition-all bg-zinc-900 ${
        item.available ? "border-zinc-800" : "border-zinc-800/60 opacity-55"
      }`}
      style={{
        boxShadow: rMeta && rMeta.cor !== "#a1a1aa"
          ? `0 0 20px -10px ${glowColor}55`
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
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1.5">
          <Chip tone={meta.tone}>{meta.label}</Chip>
          {rMeta && (
            <span
              className="inline-flex items-center gap-1 font-inconsolata uppercase text-[10px] rounded-lg px-2 py-0.5 border"
              style={{
                color: rMeta.cor,
                background: `${rMeta.cor}18`,
                borderColor: `${rMeta.cor}40`,
                letterSpacing: "0.08em",
              }}
            >
              <span className="rounded-full inline-block" style={{ width: 5, height: 5, background: rMeta.cor }} />
              {rMeta.label}
            </span>
          )}
        </div>
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
              {item.type === "title" && <Crown size={40} />}
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

      <div style={{ background: "#111113", borderTop: `1px solid ${glowColor}22` }}>
        <div className="p-3">
          <div className="flex items-center gap-2">
            <h3 className="font-jaro text-sm text-zinc-100 truncate">{item.name}</h3>
            {item.animated && (
              <span className="font-inconsolata text-[9px] uppercase px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/30 text-violet-300 shrink-0">✨ anim</span>
            )}
          </div>
          <p className="font-inconsolata text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-2" style={{ minHeight: 32 }}>
            {item.description}
          </p>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center gap-1">
              <Toggle on={item.available} onChange={() => onToggle(item.id)} size="sm" />
              <span className="font-inconsolata text-[10px] text-zinc-500 ml-1">
                {item.available ? "ativo" : "inativo"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {item.fragmentavel && (
                <span
                  className="inline-flex items-center gap-1 font-inconsolata uppercase text-[10px] rounded-lg px-2 py-0.5 border"
                  style={{
                    color: "#a78bfa",
                    borderColor: "#a78bfa44",
                    background: "#a78bfa11",
                    letterSpacing: "0.08em",
                  }}
                >
                  🧩 {item.fragmentosTotal ?? "?"} frags
                </span>
              )}
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <Pencil size={13} />
              </button>
              {confirmDel ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setConfirmDel(false); onDelete(item.id); }}
                    className="text-rose-400 hover:text-rose-300 cursor-pointer p-1"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDel(false)}
                    className="text-zinc-500 hover:text-white cursor-pointer p-1"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDel(true)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemPreview({ form, bannerCss, badgeImageUrl }: { form: Partial<ItemInput>; bannerCss?: string | null; badgeImageUrl?: string | null }) {
  const meta = getTypeMeta(form.type ?? "title");
  const isBanner = form.type === "banner";
  const isBadge = form.type === "badge";
  const bg = isBanner && bannerCss
    ? resolveBannerBackground(bannerCss)
    : { className: "", style: { background: "linear-gradient(150deg,#1f2937,#111827)" } };
  const badgeImage = badgeImageUrl || form.imageUrl;

  return (
    <div
      className="relative rounded-2xl border border-zinc-800 overflow-hidden"
      style={{ ...bg.style, boxShadow: `0 0 40px -18px rgba(34,211,238,0.5)` }}
    >
      <div className="relative p-5 bg-zinc-900/55 backdrop-blur-sm rounded-2xl">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl grid place-items-center bg-zinc-900/80 text-zinc-200">
            {isBadge && badgeImage ? (
              <img src={badgeImage} alt="" className="w-10 h-10 object-contain" />
            ) : isBanner ? (
              <ImageIcon size={22} />
            ) : form.type === "title" ? (
              <Crown size={22} />
            ) : (
              <ItemIcon name={form.icon ?? "sparkles"} size={22} />
            )}
          </div>
          <Chip tone={meta.tone}>{meta.label}</Chip>
        </div>
        <h3 className="font-jaro text-xl mt-3 text-white">
          {isBanner && bannerCss ? "Banner selecionado" : (form.name || "Nome do item")}
        </h3>
        <p className="font-inconsolata text-xs text-zinc-200/80 mt-1 leading-snug">
          {isBanner
            ? "Este item é um banner de perfil. Será vinculado a um banner existente no momento da criação."
            : (form.description || "Descrição curta do item.")}
        </p>
        <div className="flex items-center justify-between mt-4">
          <span className="inline-flex items-center gap-1.5 font-jaro text-lg text-amber-300">
            <CoinIcon size={15} />
            {(form.price ?? 0).toLocaleString("pt-BR")}
          </span>
          <span className="font-inconsolata text-[10px] text-zinc-300/80">pré-visualização</span>
        </div>
      </div>
    </div>
  );
}

const EMPTY: ItemInput = {
  name: "", description: "", price: 0,
  type: "title", value: null, icon: "sparkles", raridade: "COMUM", imageUrl: null, available: true, bannerId: null, frameId: null, badgeId: null, animated: false,
  fragmentavel: false, fragmentosTotal: null,
};
const ICON_OPTIONS = ["crown","trophy","shield","target","trending","palette","sparkles","coins"];

function ItemModal({
  item,
  banners,
  frames,
  badges,
  onClose,
  onSave,
  onUploadImage,
}: {
  item: AdminShopItem | "new" | null;
  banners: ApiBanner[];
  frames?: ApiFrame[];
  badges?: ApiBadge[];
  onClose: () => void;
  onSave: (data: ItemInput, id?: number) => Promise<number | undefined>;
  onUploadImage: (id: number, file: File) => Promise<void>;
}) {
  const isNew = item === "new";
  const initial: ItemInput | null = isNew
    ? EMPTY
    : item
      ? {
          name: item.name,
          description: item.description,
          price: item.price,
          type: item.type,
          value: item.value,
          icon: item.icon,
          raridade: item.raridade,
          imageUrl: item.imageUrl,
          available: item.available,
          bannerId: item.bannerId ?? null,
          frameId: item.frameId ?? null,
          badgeId: item.badgeId ?? null,
          animated: item.animated ?? false,
          fragmentavel: item.fragmentavel ?? false,
          fragmentosTotal: item.fragmentosTotal ?? null,
        }
      : null;
  const [form, setForm] = useState<ItemInput>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setForm(initial ?? EMPTY); setUploadFile(null); setUploadPreview(null); }, [item]);

  if (!item) return null;

  const set = (k: keyof ItemInput, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const isBanner = form.type === "banner";
  const isFrame = form.type === "frame";
  const isBadge = form.type === "badge";
  const selectedBanner = banners.find((b) => b.id === form.bannerId);
  const bannerCss = isBanner ? selectedBanner?.css ?? null : null;
  const selectedBadge = badges?.find((b) => b.id === form.badgeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.fragmentavel && (!form.fragmentosTotal || form.fragmentosTotal < 1)) {
      alert("Informe quantos fragmentos são necessários para este item");
      return;
    }
    if (form.fragmentavel && (form.price ?? 0) > 0) {
      alert("Item fragmentável não deve ter preço — remova o preço ou desative a opção de fragmentos");
      return;
    }
    if (isBadge && !form.badgeId) {
      alert("Selecione um emblema existente");
      return;
    }
    setSaving(true);
    try {
      const id = isNew ? undefined : (item as AdminShopItem).id;
      await onSave(form, id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal open={!!item} onClose={onClose} width={780}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-jaro text-lg text-white flex items-center gap-2 whitespace-nowrap">
          <Store size={18} className="text-cyan-400" />
          {isNew ? "Novo item" : "Editar item"}
        </h2>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer p-1">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid md:grid-cols-[1fr_280px] gap-5 p-5">
          <div className="space-y-4">
            <Field label="Tipo">
              <AdminSelect value={form.type} onChange={(e) => set("type", e.target.value as ItemType)}>
                <option value="title">Título</option>
                <option value="badge">Emblema</option>
                <option value="banner">Banner de perfil</option>
                <option value="frame">Moldura de avatar</option>
              </AdminSelect>
            </Field>

            {isBanner ? (
              <>
                <Field label="Banner existente" hint="Crie banners em /admin/banners">
                  <AdminSelect
                    value={form.bannerId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value ? +e.target.value : null;
                      const picked = banners.find((b) => b.id === id);
                      setForm((p) => ({ ...p, bannerId: id, animated: picked?.animated ?? false }));
                    }}
                  >
                    <option value="">— selecione —</option>
                    {banners.filter((b) => b.disponibilidade).map((b) => (
                      <option key={b.id} value={b.id}>#{b.id} · {b.nome}</option>
                    ))}
                  </AdminSelect>
                </Field>
                <Field label="Descrição (para a loja)">
                  <AdminTextarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Descrição do banner na vitrine da loja"
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  {!form.fragmentavel && (
                  <Field label="Preço (coins)">
                    <AdminInput type="number" min={0} value={form.price} onChange={(e) => set("price", +e.target.value)} required />
                  </Field>
                  )}
                  <Field label="Ícone">
                    <AdminSelect value={form.icon ?? "image"} onChange={(e) => set("icon", e.target.value)}>
                      <option value="image">image</option>
                      {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                    </AdminSelect>
                  </Field>
                </div>
              </>
            ) : isFrame ? (
              <>
                <Field label="Moldura existente" hint="Crie molduras em /admin/molduras">
                  <AdminSelect
                    value={form.frameId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value ? +e.target.value : null;
                      setForm((p) => ({ ...p, frameId: id }));
                    }}
                  >
                    <option value="">— selecione —</option>
                    {frames?.filter((f) => f.disponibilidade).map((f) => (
                      <option key={f.id} value={f.id}>#{f.id} · {f.nome}</option>
                    ))}
                  </AdminSelect>
                </Field>
                <Field label="Descrição (para a loja)">
                  <AdminTextarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Descrição da moldura na vitrine da loja"
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  {!form.fragmentavel && (
                  <Field label="Preço (coins)">
                    <AdminInput type="number" min={0} value={form.price} onChange={(e) => set("price", +e.target.value)} required />
                  </Field>
                  )}
                  <Field label="Ícone">
                    <AdminSelect value={form.icon ?? "image"} onChange={(e) => set("icon", e.target.value)}>
                      <option value="image">image</option>
                      {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                    </AdminSelect>
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label="Nome">
                  <AdminInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ex: Lendário" required />
                </Field>
                <Field label="Descrição">
                  <AdminTextarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Descrição curta" required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  {!form.fragmentavel && (
                  <Field label="Preço (coins)">
                    <AdminInput type="number" min={0} value={form.price} onChange={(e) => set("price", +e.target.value)} required />
                  </Field>
                  )}
                  {form.type === "badge" ? (
                    <Field label="Emblema existente" hint="Crie emblemas via API ou upload direto">
                      <AdminSelect
                        value={form.badgeId ?? ""}
                        onChange={(e) => set("badgeId", e.target.value ? +e.target.value : null)}
                      >
                        <option value="">— selecione —</option>
                        {badges?.filter((b) => b.disponibilidade).map((b) => (
                          <option key={b.id} value={b.id}>
                            #{b.id} · {b.nome}
                          </option>
                        ))}
                      </AdminSelect>
                    </Field>
                  ) : null}
                </div>
              </>
            )}

            <Field label="Raridade">
              <AdminSelect value={form.raridade ?? "COMUM"} onChange={(e) => set("raridade", e.target.value)}>
                <option value="COMUM">Comum</option>
                <option value="INCOMUM">Incomum</option>
                <option value="RARO">Raro</option>
                <option value="EPICO">Épico</option>
                <option value="LENDARIO">Lendário</option>
              </AdminSelect>
              <span className="ml-2 inline-block w-2 h-2 rounded-full" style={{ background: RARIDADES[form.raridade ?? "COMUM"]?.cor ?? "#9ca3af" }} />
            </Field>

            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div>
                <p className="font-inconsolata text-sm text-zinc-200">🧩 Fragmentável</p>
                <p className="font-inconsolata text-[10px] text-zinc-500">
                  {form.fragmentavel
                    ? "Item só pode ser obtido via baús — não aparece na loja"
                    : "Item disponível para compra direta na loja"}
                </p>
              </div>
              <Toggle on={form.fragmentavel ?? false} onChange={(v) => set("fragmentavel", v)} />
            </div>

            {form.fragmentavel && (
              <>
                <Field label="Fragmentos necessários">
                  <AdminInput
                    type="number"
                    min={1}
                    value={form.fragmentosTotal ?? ""}
                    onChange={(e) => set("fragmentosTotal", e.target.value ? Number(e.target.value) : null)}
                    placeholder={String(FRAGMENTOS_SUGERIDOS[form.raridade as keyof typeof FRAGMENTOS_SUGERIDOS] ?? 20)}
                  />
                  <p className="font-inconsolata text-[10px] text-zinc-500 mt-1">
                    Sugerido para {RARIDADES[form.raridade ?? "COMUM"]?.label}: {FRAGMENTOS_SUGERIDOS[form.raridade as keyof typeof FRAGMENTOS_SUGERIDOS] ?? 20} fragmentos
                  </p>
                </Field>
              </>
            )}

            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div>
                <p className="font-inconsolata text-sm text-zinc-200">Disponível na loja</p>
                <p className="font-inconsolata text-[10px] text-zinc-500">Visível para os jogadores</p>
              </div>
              <Toggle on={form.available} onChange={(v) => set("available", v)} />
            </div>

            {form.type === "title" && (form.raridade === "EPICO" || form.raridade === "LENDARIO") && (
              <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <div>
                  <p className="font-inconsolata text-sm text-zinc-200">✨ Animado</p>
                  <p className="font-inconsolata text-[10px] text-zinc-500">Título com efeito shimmer de brilho</p>
                </div>
                <Toggle on={form.animated ?? false} onChange={(v) => set("animated", v)} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                Pré-visualização
              </p>
              <ItemPreview form={form} bannerCss={bannerCss} badgeImageUrl={selectedBadge?.imageUrl} />
            </div>
            <Btn type="submit" variant="primary" icon={Check} className="justify-center w-full" disabled={saving}>
              {saving ? "Salvando…" : isNew ? "Criar item" : "Salvar"}
            </Btn>
            <Btn variant="ghost" className="justify-center w-full" onClick={onClose}>Cancelar</Btn>
          </div>
        </div>
      </form>
    </AdminModal>
  );
}

export default function AdminLojaPage() {
  const { items, loadingItems, loadItems, createItem, updateItem, toggleItem, deleteItem, uploadBadgeImage } = useAdminStore();
  const { banners, loadBanners, frames, loadFrames, badges, loadBadges } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [filter, setFilter] = useState("Todos");
  const [editing, setEditing] = useState<AdminShopItem | "new" | null>(null);

  useEffect(() => {
    loadItems().catch(() => err("Erro ao carregar itens."));
    loadBanners().catch(() => err("Erro ao carregar banners."));
    loadFrames().catch(() => err("Erro ao carregar molduras."));
    loadBadges().catch(() => err("Erro ao carregar emblemas."));
  }, [loadItems, loadBanners, loadFrames, loadBadges, err]);

  const list = items.filter((i) => {
    if (filter === "Títulos")  return i.type === "title";
    if (filter === "Emblemas") return i.type === "badge";
    if (filter === "Banners")  return i.type === "banner";
    if (filter === "Inativos") return !i.available;
    return true;
  });

  async function handleSave(data: ItemInput, id?: number): Promise<number | undefined> {
    try {
      if (id === undefined) { const created = await createItem(data); ok("Item criado!"); return created.id; }
      else                  { await updateItem(id, data); ok("Item atualizado!"); return id; }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
        ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Erro ao salvar item.";
      err(msg);
      throw new Error(msg);
    }
  }

  async function handleToggle(id: number) {
    try { await toggleItem(id); }
    catch { err("Erro ao alternar disponibilidade."); }
  }

  async function handleDelete(id: number) {
    try { await deleteItem(id); ok("Item removido."); }
    catch { err("Erro ao remover item."); }
  }

  const handleUploadBadgeImage = async (id: number, file: File) => {
    try {
      await uploadBadgeImage(id, file);
      ok("Imagem do emblema enviada!");
    } catch { err("Erro ao enviar imagem do emblema."); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Segmented
          value={filter} onChange={setFilter}
          options={["Todos","Títulos","Emblemas","Banners","Inativos"]}
        />
        <Btn variant="primary" icon={Plus} onClick={() => setEditing("new")}>
          Novo item
        </Btn>
      </div>

      {loadingItems ? (
        <p className="py-20 text-center font-inconsolata text-sm text-zinc-500">Carregando itens…</p>
      ) : list.length === 0 ? (
        <p className="py-20 text-center font-inconsolata text-sm text-zinc-600">Nenhum item nesta categoria.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((i) => (
            <ItemCard
              key={i.id} item={i}
              onEdit={setEditing}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ItemModal item={editing} banners={banners} frames={frames} badges={badges} onClose={() => setEditing(null)} onSave={handleSave} onUploadImage={handleUploadBadgeImage} />
    </div>
  );
}
