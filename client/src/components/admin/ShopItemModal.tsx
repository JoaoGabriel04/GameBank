"use client";

import { useState } from "react";
import { ShopItem } from "@/lib/admin/types";
import { X, Save } from "lucide-react";

interface ShopItemModalProps {
  item: ShopItem | null;
  isOpen: boolean;
  isCreating: boolean;
  onClose: () => void;
  onItemUpdated?: () => void;
}

const ITEM_TYPES = [
  { value: "title" as const, label: "Título" },
  { value: "badge" as const, label: "Badge" },
];

const EMOJI_PICKER = ["👑", "🏆", "⭐", "📺", "🔥", "💎", "🎖️", "🌟", "✨", "🎯"];

export default function ShopItemModal({
  item,
  isOpen,
  isCreating,
  onClose,
  onItemUpdated,
}: ShopItemModalProps) {
  const [formData, setFormData] = useState({
    name: item?.name || "",
    description: item?.description || "",
    type: item?.type || "title" as const,
    price: item?.price || 0,
    icon: item?.icon || "⭐",
    value: item?.value || "",
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.value) {
      alert("Nome e ID do item são obrigatórios");
      return;
    }

    try {
      // TODO: API call to create/update item
      console.log(`${isCreating ? "Criando" : "Atualizando"} item:`, formData);
      onItemUpdated?.();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar item:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-jaro font-bold text-zinc-100">
            {isCreating ? "Novo Item" : "Editar Item"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Icon */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Ícone</label>
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-full admin-card p-4 text-center text-4xl hover:bg-zinc-800 transition-colors"
                >
                  {formData.icon}
                </button>

                {showEmojiPicker && (
                  <div className="absolute top-full mt-2 left-0 right-0 bg-zinc-800 border border-zinc-700 rounded-lg p-3 z-10">
                    <div className="grid grid-cols-5 gap-2">
                      {EMOJI_PICKER.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            handleInputChange("icon", emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="text-2xl p-2 rounded hover:bg-zinc-700 transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Nome</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="admin-input w-full"
                placeholder="Ex: Coroa Dourada"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                className="admin-input w-full resize-none h-24"
                placeholder="Descrição do item"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange("type", e.target.value)}
                className="admin-input w-full"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Preço (R$)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => handleInputChange("price", parseInt(e.target.value) || 0)}
                className="admin-input w-full"
                placeholder="0 = Gratuito"
                min="0"
              />
            </div>

            {/* Value (ID) */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">ID do Item</label>
              <input
                type="text"
                value={formData.value}
                onChange={(e) => handleInputChange("value", e.target.value.toUpperCase())}
                className="admin-input w-full font-mono"
                placeholder="Ex: GOLDEN_CROWN"
              />
              <p className="text-xs text-zinc-500 mt-1">Use MAIÚSCULAS e UNDERSCORES</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-6 py-4 flex items-center gap-3 bg-zinc-950">
          <button
            onClick={onClose}
            className="flex-1 admin-button-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 admin-button-primary flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isCreating ? "Criar" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
