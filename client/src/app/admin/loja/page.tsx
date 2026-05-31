"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { AdminShopItem, ItemInput } from "@/services/api/admin";

const TYPE_LABELS: Record<string, string> = {
  title: "Título",
  badge: "Emblema",
  color: "Cor",
};

const TYPE_GRADIENT: Record<string, string> = {
  title: "from-violet-500/20 to-violet-600/5 border-violet-500/30",
  badge: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30",
  color: "from-amber-500/20 to-amber-600/5 border-amber-500/30",
};

const EMPTY_FORM: ItemInput = {
  name: "",
  description: "",
  price: 0,
  type: "title",
  value: null,
  icon: null,
  available: true,
};

function ItemCard({
  item,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: AdminShopItem;
  onEdit: (item: AdminShopItem) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br p-4 ${TYPE_GRADIENT[item.type] ?? "from-zinc-800/50 border-zinc-700"} ${!item.available ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-jaro text-base text-white truncate">{item.name}</p>
          <p className="text-xs font-inconsolata text-zinc-400 truncate">{item.description}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-inconsolata px-2 py-0.5 rounded-full border ${TYPE_GRADIENT[item.type]}`}>
          {TYPE_LABELS[item.type]}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div>
          <p className="text-sm font-inconsolata text-yellow-400 font-bold">{item.price} coins</p>
          <p className="text-[10px] font-inconsolata text-zinc-500">{item.ownerCount} donos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle disponibilidade */}
          <button
            onClick={() => onToggle(item.id)}
            title={item.available ? "Desativar" : "Ativar"}
            className={`w-9 h-5 rounded-full transition-colors ${item.available ? "bg-green-500" : "bg-zinc-600"}`}
          >
            <span className={`block w-4 h-4 rounded-full bg-white mx-0.5 transition-transform ${item.available ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          {/* Editar */}
          <button onClick={() => onEdit(item)} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <Pencil className="w-4 h-4" />
          </button>
          {/* Deletar */}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(item.id)} className="text-red-400 hover:text-red-300 cursor-pointer">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-zinc-400 hover:text-red-400 transition-colors cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemModal({
  initial,
  onClose,
  onSave,
}: {
  initial: ItemInput | null;
  onClose: () => void;
  onSave: (data: ItemInput) => Promise<void>;
}) {
  const [form, setForm] = useState<ItemInput>(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function set(key: keyof ItemInput, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Preview ao vivo
  const previewItem: AdminShopItem = { ...form, id: 0, ownerCount: 0 };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="font-jaro text-lg text-white">{initial ? "Editar Item" : "Novo Item"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 p-6">
          {/* Formulário */}
          <form onSubmit={handleSubmit} className="flex-1 space-y-4">
            <div>
              <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Nome</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} required className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Descrição</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} required rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Tipo</label>
                <select value={form.type} onChange={(e) => set("type", e.target.value as ItemInput["type"])} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none">
                  <option value="title">Título</option>
                  <option value="badge">Emblema</option>
                  <option value="color">Cor</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Preço (coins)</label>
                <input type="number" min={0} value={form.price} onChange={(e) => set("price", Number(e.target.value))} required className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Valor (ex: #ff6600, slug)</label>
              <input value={form.value ?? ""} onChange={(e) => set("value", e.target.value || null)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Ícone (FA ou URL)</label>
              <input value={form.icon ?? ""} onChange={(e) => set("icon", e.target.value || null)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.available} onChange={(e) => set("available", e.target.checked)} className="accent-green-500 w-4 h-4" />
              <span className="text-sm font-inconsolata text-zinc-300">Disponível na loja</span>
            </label>

            <button type="submit" disabled={saving} className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white font-inconsolata rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </form>

          {/* Preview */}
          <div className="w-full md:w-52 shrink-0">
            <p className="text-xs font-inconsolata text-zinc-500 mb-2 text-center">Preview</p>
            <ItemCard item={previewItem} onEdit={() => {}} onToggle={() => {}} onDelete={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}

const FILTERS_TYPE = ["todos", "title", "badge", "color"] as const;
const FILTERS_STATUS = ["todos", "ativos", "inativos"] as const;

export default function AdminLojaPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { items, loadingItems, loadItems, createItem, updateItem, toggleItem, deleteItem } = useAdminStore();
  const { success: toastSuccess, error: toastError } = useToast();

  const [filterType, setFilterType] = useState<typeof FILTERS_TYPE[number]>("todos");
  const [filterStatus, setFilterStatus] = useState<typeof FILTERS_STATUS[number]>("todos");
  const [modalItem, setModalItem] = useState<AdminShopItem | null | "new">(null);

  useEffect(() => {
    if (user !== null && !user.isAdmin) router.replace("/");
  }, [user, router]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = items.filter((item) => {
    if (filterType !== "todos" && item.type !== filterType) return false;
    if (filterStatus === "ativos" && !item.available) return false;
    if (filterStatus === "inativos" && item.available) return false;
    return true;
  });

  async function handleSave(data: ItemInput) {
    try {
      if (modalItem === "new") {
        await createItem(data);
        toastSuccess("Item criado!");
      } else if (modalItem) {
        await updateItem(modalItem.id, data);
        toastSuccess("Item atualizado!");
      }
    } catch {
      toastError("Erro ao salvar item.");
      throw new Error("save failed");
    }
  }

  async function handleToggle(id: number) {
    try {
      await toggleItem(id);
    } catch {
      toastError("Erro ao alternar disponibilidade.");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteItem(id);
      toastSuccess("Item removido.");
    } catch {
      toastError("Erro ao remover item.");
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-jaro text-2xl text-white flex items-center gap-2">
          🏪 Itens da Loja
          <span className="text-sm font-inconsolata text-zinc-500 font-normal">({items.length})</span>
        </h1>
        <button
          onClick={() => setModalItem("new")}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-inconsolata rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Item
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS_TYPE.map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-inconsolata border transition-colors cursor-pointer ${filterType === f ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >
            {f === "todos" ? "Todos" : TYPE_LABELS[f]}
          </button>
        ))}
        <div className="w-px bg-zinc-700 mx-1" />
        {FILTERS_STATUS.map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-inconsolata border transition-colors cursor-pointer ${filterStatus === f ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loadingItems ? (
        <p className="text-zinc-500 font-inconsolata text-center py-20">Carregando itens...</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 font-inconsolata text-center py-20">Nenhum item encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={(i) => setModalItem(i)}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modalItem !== null && (
        <ItemModal
          initial={modalItem === "new" ? null : modalItem}
          onClose={() => setModalItem(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
