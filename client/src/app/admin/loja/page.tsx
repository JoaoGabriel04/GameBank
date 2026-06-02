"use client";

import { useEffect, useState } from "react";
import {
  Store, Plus, Pencil, Trash2, Check, X, Crown, Trophy,
  TrendingUp, Target, Palette, Sparkles, Coins, Shield, Image as ImageIcon,
} from "lucide-react";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import { resolveSprite } from "@/constants/sprites";
import type { AdminShopItem, Banner as ApiBanner, ItemInput } from "@/services/api/admin";
import {
  Panel, Chip, Toggle, Segmented, Btn, Field,
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

type ItemType = "title" | "badge" | "banner";

const TYPE_META: Record<ItemType, { label: string; tone: "amber" | "violet" | "emerald" }> = {
  title:  { label: "Título",  tone: "amber"   },
  badge:  { label: "Emblema", tone: "violet"  },
  banner: { label: "Banner",  tone: "emerald" },
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
  const bannerStyle = isBanner && item.value
    ? { backgroundImage: item.value, boxShadow: `0 0 30px -14px rgba(34, 211, 238, 0.5)` }
    : { boxShadow: "none" };

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden transition-all bg-zinc-900 ${
        item.available ? "border-zinc-800" : "border-zinc-800/60 opacity-55"
      }`}
      style={bannerStyle}
    >
      {isBanner && item.value && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: item.value, opacity: 0.35 }} />
      )}

      <div className="relative p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-11 h-11 rounded-xl grid place-items-center bg-zinc-900/70 backdrop-blur-sm text-zinc-200`}>
            {isBanner ? <ImageIcon size={20} /> : <ItemIcon name={item.icon} size={20} />}
          </div>
          <Chip tone={meta.tone}>{meta.label}</Chip>
        </div>

        <h3 className="font-jaro text-base text-zinc-100">
          {item.name}
        </h3>
        <p className="font-inconsolata text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-2 h-8">
          {item.description}
        </p>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800/80">
          <div className="flex items-center gap-1">
            <Toggle on={item.available} onChange={() => onToggle(item.id)} size="sm" />
            <span className="font-inconsolata text-[10px] text-zinc-500 ml-1">
              {item.available ? "ativo" : "inativo"}
            </span>
          </div>
          <div className="flex items-center gap-1">
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
  );
}

function ItemPreview({ form, bannerCss, bannerSpriteId }: { form: Partial<ItemInput>; bannerCss?: string | null; bannerSpriteId?: string | null }) {
  const meta = getTypeMeta(form.type ?? "title");
  const isBanner = form.type === "banner";
  const bg = isBanner && bannerCss ? bannerCss : "linear-gradient(150deg,#1f2937,#111827)";
  const SpriteIcon = isBanner && bannerSpriteId ? resolveSprite(bannerSpriteId)?.icon : null;

  return (
    <div
      className="relative rounded-2xl border border-zinc-800 overflow-hidden"
      style={{ background: bg, boxShadow: `0 0 40px -18px rgba(34,211,238,0.5)` }}
    >
      <div className="relative p-5 bg-zinc-900/40 backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl grid place-items-center bg-zinc-900/70 text-zinc-200">
            {SpriteIcon
              ? <SpriteIcon size={22} />
              : isBanner
              ? <ImageIcon size={22} />
              : <ItemIcon name={form.icon ?? "sparkles"} size={22} />}
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
            <Coins size={15} />
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
  type: "title", value: null, icon: "sparkles", available: true, bannerId: null,
};
const ICON_OPTIONS = ["crown","trophy","shield","target","trending","palette","sparkles","coins"];

function ItemModal({
  item,
  banners,
  onClose,
  onSave,
}: {
  item: AdminShopItem | "new" | null;
  banners: ApiBanner[];
  onClose: () => void;
  onSave: (data: ItemInput, id?: number) => Promise<void>;
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
          available: item.available,
          bannerId: item.bannerId ?? null,
        }
      : null;
  const [form, setForm] = useState<ItemInput>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ?? EMPTY); }, [item]);

  if (!item) return null;

  const set = (k: keyof ItemInput, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const isBanner = form.type === "banner";
  const selectedBanner = banners.find((b) => b.id === form.bannerId);
  const bannerCss = isBanner ? selectedBanner?.css ?? null : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form, isNew ? undefined : (item as AdminShopItem).id);
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
              </AdminSelect>
            </Field>

            {isBanner ? (
              <>
                <Field label="Banner existente" hint="Crie banners em /admin/cosmeticos">
                  <AdminSelect
                    value={form.bannerId ?? ""}
                    onChange={(e) => set("bannerId", e.target.value ? +e.target.value : null)}
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
                  <Field label="Preço (coins)">
                    <AdminInput type="number" min={0} value={form.price} onChange={(e) => set("price", +e.target.value)} required />
                  </Field>
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
                  <Field label="Preço (coins)">
                    <AdminInput type="number" min={0} value={form.price} onChange={(e) => set("price", +e.target.value)} required />
                  </Field>
                  <Field label="Ícone">
                    <AdminSelect value={form.icon ?? "sparkles"} onChange={(e) => set("icon", e.target.value)}>
                      {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                    </AdminSelect>
                  </Field>
                </div>
                <Field label={isBanner ? "Banner (css)" : "Valor / slug"} hint="slug ou valor">
                  <AdminInput
                    value={form.value ?? ""}
                    onChange={(e) => set("value", e.target.value || null)}
                    placeholder={isBanner ? "linear-gradient(120deg,…)" : "ex: legend"}
                  />
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
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                Pré-visualização
              </p>
              <ItemPreview form={form} bannerCss={bannerCss} />
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
  const { items, loadingItems, loadItems, createItem, updateItem, toggleItem, deleteItem } = useAdminStore();
  const { banners, loadBanners } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [filter, setFilter] = useState("Todos");
  const [editing, setEditing] = useState<AdminShopItem | "new" | null>(null);

  useEffect(() => {
    loadItems().catch(() => err("Erro ao carregar itens."));
    loadBanners().catch(() => err("Erro ao carregar banners."));
  }, [loadItems, loadBanners, err]);

  const list = items.filter((i) => {
    if (filter === "Títulos")  return i.type === "title";
    if (filter === "Emblemas") return i.type === "badge";
    if (filter === "Banners")  return i.type === "banner";
    if (filter === "Inativos") return !i.available;
    return true;
  });

  async function handleSave(data: ItemInput, id?: number) {
    try {
      if (id === undefined) { await createItem(data); ok("Item criado!"); }
      else                  { await updateItem(id, data); ok("Item atualizado!"); }
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

      <ItemModal item={editing} banners={banners} onClose={() => setEditing(null)} onSave={handleSave} />
    </div>
  );
}
