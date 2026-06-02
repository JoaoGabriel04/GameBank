"use client";

/**
 * Loja — Admin
 * Salve em: src/app/admin/loja/page.tsx
 * Melhorias vs atual: cards com glow + gradiente, modal com preview ao vivo,
 * segmented control, tipo "color" suportado visualmente.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store, Plus, Pencil, Trash2, Check, X, Crown, Trophy,
  TrendingUp, Target, Palette, Sparkles, Coins, Shield,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import type { AdminShopItem, ItemInput } from "@/services/api/admin";
import {
  Panel, Chip, Toggle, Segmented, Btn, Field,
  AdminInput, AdminTextarea, AdminSelect, AdminModal,
} from "@/components/admin/AdminUI";

/* ── Icon map ── */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  crown: Crown, trophy: Trophy, trending: TrendingUp, target: Target,
  palette: Palette, sparkles: Sparkles, coins: Coins, shield: Shield,
};

function ItemIcon({ name, size = 20 }: { name: string | null; size?: number }) {
  const I = ICON_MAP[name ?? "sparkles"] ?? Sparkles;
  return <I size={size} />;
}

/* ── Type metadata ── */
type ItemType = "title" | "badge" | "color";

const TYPE_META: Record<ItemType, { label: string; tone: "amber" | "violet" | "emerald"; grad: string; color: string }> = {
  title: { label: "Título",   tone: "amber",   grad: "from-amber-500/15 to-amber-500/0",   color: "#f59e0b" },
  badge: { label: "Emblema",  tone: "violet",  grad: "from-violet-500/15 to-violet-500/0", color: "#a78bfa" },
  color: { label: "Cor",      tone: "emerald", grad: "from-emerald-500/15 to-emerald-500/0", color: "#34d399" },
};

function getTypeMeta(type: string) {
  return TYPE_META[type as ItemType] ?? TYPE_META.title;
}

/* ── Item card preview (used in grid AND inside modal) ── */
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
  const accent = item.type === "color" && item.value ? item.value : meta.color;

  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-b ${meta.grad} p-4 overflow-hidden transition-all ${
        item.available ? "border-zinc-800" : "border-zinc-800/60 opacity-55"
      }`}
      style={{ boxShadow: item.available ? `0 0 30px -14px ${accent}` : "none" }}
    >
      {/* Glow blob */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none"
        style={{ background: accent }}
      />

      <div className="flex items-start justify-between mb-3 relative">
        <div
          className="w-11 h-11 rounded-xl grid place-items-center"
          style={{ background: accent + "22", color: accent }}
        >
          <ItemIcon name={item.icon} size={20} />
        </div>
        <Chip tone={meta.tone}>{meta.label}</Chip>
      </div>

      <h3
        className="font-jaro text-base relative"
        style={{ color: item.type === "color" && item.value ? item.value : "#f4f4f5" }}
      >
        {item.name}
      </h3>
      <p className="font-inconsolata text-[11px] text-zinc-500 mt-0.5 leading-snug relative line-clamp-2 h-8">
        {item.description}
      </p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800 relative">
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
  );
}

/* ── Live preview card (inside modal) ── */
function ItemPreview({ form }: { form: Partial<ItemInput> }) {
  const meta = getTypeMeta(form.type ?? "title");
  const accent = form.type === "color" && form.value ? form.value : meta.color;
  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-b ${meta.grad} p-5 overflow-hidden`}
      style={{ boxShadow: `0 0 40px -18px ${accent}` }}
    >
      <div className="flex items-start justify-between relative">
        <div className="w-12 h-12 rounded-xl grid place-items-center" style={{ background: accent + "22", color: accent }}>
          <ItemIcon name={form.icon ?? "sparkles"} size={22} />
        </div>
        <Chip tone={meta.tone}>{meta.label}</Chip>
      </div>
      <h3 className="font-jaro text-xl mt-3 relative" style={{ color: form.type === "color" && form.value ? form.value : "#fff" }}>
        {form.name || "Nome do item"}
      </h3>
      <p className="font-inconsolata text-xs text-zinc-400 mt-1 relative leading-snug">
        {form.description || "Descrição curta do item."}
      </p>
      <div className="flex items-center justify-between mt-4 relative">
        <span className="inline-flex items-center gap-1.5 font-jaro text-lg text-amber-300">
          <Coins size={15} />
          {(form.price ?? 0).toLocaleString("pt-BR")}
        </span>
        <span className="font-inconsolata text-[10px] text-zinc-500">pré-visualização</span>
      </div>
    </div>
  );
}

/* ── Item modal (create / edit) ── */
const EMPTY: ItemInput = {
  name: "", description: "", price: 0,
  type: "title", value: null, icon: "sparkles", available: true,
};
const ICON_OPTIONS = ["crown","trophy","shield","target","trending","palette","sparkles","coins"];

function ItemModal({
  item,
  onClose,
  onSave,
}: {
  item: AdminShopItem | "new" | null;
  onClose: () => void;
  onSave: (data: ItemInput, id?: number) => Promise<void>;
}) {
  const isNew = item === "new";
  const initial = isNew ? EMPTY : (item ? { ...item } as ItemInput : null);
  const [form, setForm] = useState<ItemInput>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ?? EMPTY); }, [item]);

  if (!item) return null;

  const set = (k: keyof ItemInput, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

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
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-jaro text-lg text-white flex items-center gap-2 whitespace-nowrap">
          <Store size={18} className="text-cyan-400" />
          {isNew ? "Novo item" : "Editar item"}
        </h2>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer p-1">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit}>
        <div className="grid md:grid-cols-[1fr_280px] gap-5 p-5">
          {/* Left — form */}
          <div className="space-y-4">
            <Field label="Nome">
              <AdminInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ex: Lendário" required />
            </Field>

            <Field label="Descrição">
              <AdminTextarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Descrição curta" required />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <AdminSelect value={form.type} onChange={(e) => set("type", e.target.value)}>
                  <option value="title">Título</option>
                  <option value="badge">Emblema</option>
                  <option value="color">Cor (visual only)</option>
                </AdminSelect>
              </Field>
              <Field label="Preço (coins)">
                <AdminInput type="number" min={0} value={form.price} onChange={(e) => set("price", +e.target.value)} required />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={form.type === "color" ? "Cor (hex)" : "Valor / slug"} hint={form.type === "color" ? "ex: #22d3ee" : "slug ou valor"}>
                <div className="flex items-center gap-2">
                  {form.type === "color" && (
                    <input
                      type="color"
                      value={form.value ?? "#22d3ee"}
                      onChange={(e) => set("value", e.target.value)}
                      className="w-9 h-9 rounded-xl bg-transparent border border-zinc-700 cursor-pointer shrink-0"
                    />
                  )}
                  <AdminInput
                    value={form.value ?? ""}
                    onChange={(e) => set("value", e.target.value || null)}
                  />
                </div>
              </Field>
              <Field label="Ícone">
                <AdminSelect value={form.icon ?? "sparkles"} onChange={(e) => set("icon", e.target.value)}>
                  {ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>{ic}</option>
                  ))}
                </AdminSelect>
              </Field>
            </div>

            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div>
                <p className="font-inconsolata text-sm text-zinc-200">Disponível na loja</p>
                <p className="font-inconsolata text-[10px] text-zinc-500">Visível para os jogadores</p>
              </div>
              <Toggle on={form.available} onChange={(v) => set("available", v)} />
            </div>
          </div>

          {/* Right — preview + actions */}
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                Pré-visualização
              </p>
              <ItemPreview form={form} />
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

/* ── Main page ── */
export default function AdminLojaPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { items, loadingItems, loadItems, createItem, updateItem, toggleItem, deleteItem } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [filter, setFilter] = useState("Todos");
  const [editing, setEditing] = useState<AdminShopItem | "new" | null>(null);

  useEffect(() => {
    if (user !== null && !user.isAdmin) router.replace("/");
  }, [user, router]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const list = items.filter((i) => {
    if (filter === "Títulos")  return i.type === "title";
    if (filter === "Emblemas") return i.type === "badge";
    if (filter === "Inativos") return !i.available;
    return true;
  });

  async function handleSave(data: ItemInput, id?: number) {
    try {
      if (id === undefined) { await createItem(data); ok("Item criado!"); }
      else                  { await updateItem(id, data); ok("Item atualizado!"); }
    } catch { err("Erro ao salvar item."); throw new Error(); }
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
          options={["Todos","Títulos","Emblemas","Inativos"]}
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

      <ItemModal item={editing} onClose={() => setEditing(null)} onSave={handleSave} />
    </div>
  );
}
