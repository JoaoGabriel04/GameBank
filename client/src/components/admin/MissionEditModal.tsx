"use client";

import React, { useState } from "react";
import { Modal } from "./AdminBase";
import { Mission } from "@/lib/admin/types";
import { Target } from "lucide-react";

interface MissionEditModalProps {
  mission: Mission | null;
  open: boolean;
  onClose: () => void;
}

const METRICS = [
  { value: "total_games", label: "Total de Partidas" },
  { value: "total_wins", label: "Total de Vitórias" },
  { value: "total_coins", label: "Total de Moedas" },
  { value: "total_xp", label: "Total de XP" },
];

export default function MissionEditModal({
  mission,
  open,
  onClose,
}: MissionEditModalProps) {
  const [data, setData] = useState<Mission>(
    mission || {
      id: 0,
      name: "",
      description: "",
      metric: "total_wins",
      target: 10,
      xpReward: 500,
      coinReward: 250,
    }
  );

  React.useEffect(() => {
    if (mission) setData(mission);
  }, [mission]);

  if (!mission) return null;

  const set = (k: keyof Mission, v: any) => {
    setData((prev) => ({ ...prev, [k]: v }));
  };

  return (
    <Modal open={open} onClose={onClose} width={560}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-jaro text-lg text-white flex items-center gap-2 whitespace-nowrap">
          <Target size={18} className="text-cyan-400" />
          {mission.id ? "Editar missão" : "Nova missão"}
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white cursor-pointer p-1"
        >
          ✕
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Nome */}
        <div>
          <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
            Nome
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="ex: Campeão Absoluto"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
            Descrição
          </label>
          <textarea
            rows={2}
            value={data.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
          />
        </div>

        {/* Métrica & Meta */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
              Métrica
            </label>
            <select
              value={data.metric}
              onChange={(e) => set("metric", e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
            >
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
              Meta
            </label>
            <input
              type="number"
              value={data.target}
              onChange={(e) => set("target", parseInt(e.target.value) || 0)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Recompensas */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
              Recompensa XP
            </label>
            <input
              type="number"
              value={data.xpReward}
              onChange={(e) => set("xpReward", parseInt(e.target.value) || 0)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          <div>
            <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
              Recompensa Coins
            </label>
            <input
              type="number"
              value={data.coinReward}
              onChange={(e) => set("coinReward", parseInt(e.target.value) || 0)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 transition-colors font-mono text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-600 transition-colors font-mono text-sm font-medium"
          >
            {mission.id ? "Salvar" : "Criar missão"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
