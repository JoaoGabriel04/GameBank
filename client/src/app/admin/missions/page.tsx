"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHead } from "@/components/admin/AdminBase";
import MissionEditModal from "@/components/admin/MissionEditModal";
import { Mission } from "@/lib/admin/types";
import { Target, Plus, Edit2, Trash2 } from "lucide-react";

export default function AdminMissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  async function load() {
    setLoading(true);
    try {
      const mockMissions: Mission[] = [
        {
          id: 1,
          name: "Primeira Vitória",
          description: "Ganhe sua primeira partida",
          metric: "total_wins",
          target: 1,
          xpReward: 100,
          coinReward: 500,
        },
        {
          id: 2,
          name: "Vencedor Experiente",
          description: "Ganhe 10 partidas",
          metric: "total_wins",
          target: 10,
          xpReward: 500,
          coinReward: 2500,
        },
        {
          id: 3,
          name: "Jogador Ativo",
          description: "Jogue 50 partidas",
          metric: "total_games",
          target: 50,
          xpReward: 300,
          coinReward: 1500,
        },
        {
          id: 4,
          name: "Lenda do Tabuleiro",
          description: "Ganhe 100 partidas",
          metric: "total_wins",
          target: 100,
          xpReward: 2000,
          coinReward: 10000,
        },
      ];
      setMissions(mockMissions);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-jaro text-xl text-white">
          {missions.length} missão(ões)
        </h2>
        <button className="px-3 py-2 rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-600 transition-colors font-mono text-sm flex items-center gap-2">
          <Plus size={16} />
          Nova Missão
        </button>
      </div>

      <Panel flush>
        <PanelHead title="Missões do sistema" icon={Target} />
        <div className="divide-y divide-zinc-800">
          {missions.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between p-4 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex-1">
                <h3 className="font-jaro text-sm font-semibold text-zinc-100 mb-1">
                  {m.name}
                </h3>
                <p className="font-mono text-xs text-zinc-500 mb-2">
                  {m.description}
                </p>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="font-mono text-zinc-600">Meta</span>
                    <p className="font-jaro text-cyan-400 mt-0.5">{m.target}</p>
                  </div>
                  <div>
                    <span className="font-mono text-zinc-600">XP</span>
                    <p className="font-jaro text-purple-400 mt-0.5">
                      +{m.xpReward}
                    </p>
                  </div>
                  <div>
                    <span className="font-mono text-zinc-600">Moedas</span>
                    <p className="font-jaro text-amber-400 mt-0.5">
                      +{m.coinReward}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button
                  onClick={() => setSelectedMission(m)}
                  className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <MissionEditModal
        mission={selectedMission}
        open={!!selectedMission}
        onClose={() => setSelectedMission(null)}
      />
    </div>
  );
}
