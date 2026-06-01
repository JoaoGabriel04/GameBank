"use client";

import { useState } from "react";
import { GameCard } from "@/lib/admin/types";
import { X, Save } from "lucide-react";

interface GameCardModalProps {
  card: GameCard | null;
  isOpen: boolean;
  isCreating: boolean;
  onClose: () => void;
  onCardUpdated?: () => void;
}

const CARD_TYPES = [
  { value: "ganhar_dinheiro" as const, label: "💰 Ganhar Dinheiro", icon: "📈" },
  { value: "perder_dinheiro" as const, label: "💸 Perder Dinheiro", icon: "📉" },
  { value: "receber_jogadores" as const, label: "👥 Receber de Jogadores", icon: "📥" },
  { value: "pagar_jogadores" as const, label: "👥 Pagar Jogadores", icon: "📤" },
  { value: "carta_prisao" as const, label: "🚔 Sair da Prisão", icon: "🔓" },
  { value: "prisao" as const, label: "🚔 Ir para Prisão", icon: "🔒" },
];

const BARALHOS = [
  { value: "sorte" as const, label: "🍀 Sorte" },
  { value: "reves" as const, label: "⚠️ Revés" },
];

export default function GameCardModal({
  card,
  isOpen,
  isCreating,
  onClose,
  onCardUpdated,
}: GameCardModalProps) {
  const [formData, setFormData] = useState({
    texto: card?.texto || "",
    tipo: card?.tipo || "ganhar_dinheiro" as const,
    valor: card?.valor || 0,
    baralho: card?.baralho || "sorte" as const,
  });

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.texto.trim()) {
      alert("Descrição da carta é obrigatória");
      return;
    }

    try {
      // TODO: API call to create/update card
      console.log(`${isCreating ? "Criando" : "Atualizando"} carta:`, formData);
      onCardUpdated?.();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar carta:", error);
    }
  };

  const selectedType = CARD_TYPES.find((t) => t.value === formData.tipo);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-jaro font-bold text-zinc-100">
            {isCreating ? "Nova Carta" : "Editar Carta"}
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
            {/* Preview */}
            <div className="admin-card p-6 bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-zinc-700 rounded-xl">
              <div className="text-center space-y-3">
                <div className="text-5xl">{selectedType?.icon}</div>
                <p className="text-sm font-mono text-zinc-400">{selectedType?.label}</p>
                <p className="text-lg font-jaro text-zinc-100 leading-relaxed">
                  {formData.texto || "Descrição da carta..."}
                </p>
                {formData.valor > 0 && (
                  <p className="text-2xl font-jaro font-bold text-amber-400">
                    R$ {formData.valor.toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>

            {/* Baralho */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Baralho</label>
              <div className="grid grid-cols-2 gap-2">
                {BARALHOS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => handleInputChange("baralho", b.value)}
                    className={`admin-card p-3 text-center transition-colors ${
                      formData.baralho === b.value
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "hover:border-zinc-600"
                    }`}
                  >
                    <p className="text-2xl mb-1">{b.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Tipo</label>
              <select
                value={formData.tipo}
                onChange={(e) => handleInputChange("tipo", e.target.value)}
                className="admin-input w-full"
              >
                {CARD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Descrição</label>
              <textarea
                value={formData.texto}
                onChange={(e) => handleInputChange("texto", e.target.value)}
                className="admin-input w-full resize-none h-20"
                placeholder="O que acontece quando a carta é sorteada?"
              />
            </div>

            {/* Value */}
            {["ganhar_dinheiro", "perder_dinheiro", "receber_jogadores", "pagar_jogadores"].includes(
              formData.tipo
            ) && (
              <div>
                <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Valor (R$)</label>
                <input
                  type="number"
                  value={formData.valor}
                  onChange={(e) => handleInputChange("valor", parseInt(e.target.value) || 0)}
                  className="admin-input w-full"
                  min="0"
                />
              </div>
            )}
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
