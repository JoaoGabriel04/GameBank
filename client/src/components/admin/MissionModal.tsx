"use client";

import { useState } from "react";
import { Mission } from "@/lib/admin/types";
import { X, Save } from "lucide-react";

interface MissionModalProps {
  mission: Mission | null;
  isOpen: boolean;
  isCreating: boolean;
  onClose: () => void;
  onMissionUpdated?: () => void;
}

const METRICS = [
  { value: "total_games" as const, label: "Total de Partidas" },
  { value: "total_wins" as const, label: "Total de Vitórias" },
  { value: "total_coins" as const, label: "Total de Moedas Acumuladas" },
  { value: "total_xp" as const, label: "Total de XP" },
];

export default function MissionModal({
  mission,
  isOpen,
  isCreating,
  onClose,
  onMissionUpdated,
}: MissionModalProps) {
  const [formData, setFormData] = useState({
    name: mission?.name || "",
    description: mission?.description || "",
    metric: mission?.metric || "total_games" as const,
    target: mission?.target || 10,
    xpReward: mission?.xpReward || 100,
    coinReward: mission?.coinReward || 500,
  });

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      alert("Nome e descrição são obrigatórios");
      return;
    }

    try {
      // TODO: API call to create/update mission
      console.log(`${isCreating ? "Criando" : "Atualizando"} missão:`, formData);
      onMissionUpdated?.();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar missão:", error);
    }
  };

  const metricLabel = METRICS.find((m) => m.value === formData.metric)?.label || "";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-jaro font-bold text-zinc-100">
            {isCreating ? "Nova Missão" : "Editar Missão"}
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
            <div className="admin-card p-4 bg-gradient-to-br from-purple-900/20 to-zinc-900">
              <div className="space-y-2">
                <p className="text-lg font-jaro font-bold text-zinc-100">{formData.name || "Missão"}</p>
                <p className="text-sm text-zinc-300">{formData.description || "Descrição..."}</p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Meta</p>
                    <p className="font-mono font-bold text-cyan-400">{formData.target}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">XP</p>
                    <p className="font-mono font-bold text-purple-400">+{formData.xpReward}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Moedas</p>
                    <p className="font-mono font-bold text-amber-400">+{formData.coinReward}</p>
                  </div>
                </div>
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
                placeholder="Ex: Primeira Vitória"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                className="admin-input w-full resize-none h-16"
                placeholder="O que o jogador precisa fazer?"
              />
            </div>

            {/* Metric */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Métrica</label>
              <select
                value={formData.metric}
                onChange={(e) => handleInputChange("metric", e.target.value)}
                className="admin-input w-full"
              >
                {METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target */}
            <div>
              <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">
                Meta ({metricLabel})
              </label>
              <input
                type="number"
                value={formData.target}
                onChange={(e) => handleInputChange("target", parseInt(e.target.value) || 0)}
                className="admin-input w-full"
                min="1"
              />
            </div>

            {/* Rewards */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Recompensa XP</label>
                <input
                  type="number"
                  value={formData.xpReward}
                  onChange={(e) => handleInputChange("xpReward", parseInt(e.target.value) || 0)}
                  className="admin-input w-full"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-mono uppercase text-zinc-400 mb-2">Recompensa Moedas</label>
                <input
                  type="number"
                  value={formData.coinReward}
                  onChange={(e) => handleInputChange("coinReward", parseInt(e.target.value) || 0)}
                  className="admin-input w-full"
                  min="0"
                />
              </div>
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
