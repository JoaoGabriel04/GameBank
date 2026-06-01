"use client";

import { useEffect, useState } from "react";
import { Panel, Chip } from "@/components/admin/AdminBase";
import { Image, Edit2, Trash2 } from "lucide-react";

interface Cosmetic {
  id: number;
  name: string;
  type: "avatar" | "emoji" | "effect" | "theme";
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
}

export default function AdminCosmeticsPage() {
  const [cosmetics, setCos] = useState<Cosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  async function load() {
    setLoading(true);
    try {
      const mockCosmetics: Cosmetic[] = [
        {
          id: 1,
          name: "Avatar Robot",
          type: "avatar",
          icon: "🤖",
          rarity: "common",
          description: "Um avatar robô minimalista",
        },
        {
          id: 2,
          name: "Avatar Astronauta",
          type: "avatar",
          icon: "👨‍🚀",
          rarity: "rare",
          description: "Avatar espacial estilizado",
        },
        {
          id: 3,
          name: "Emoji Celebração",
          type: "emoji",
          icon: "🎉",
          rarity: "common",
          description: "Emoji para comemorar vitórias",
        },
        {
          id: 4,
          name: "Efeito Ouro",
          type: "effect",
          icon: "✨",
          rarity: "epic",
          description: "Efeito especial de ouro ao ganhar",
        },
      ];
      setCos(mockCosmetics);
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

  const RARITY_COLORS: Record<string, string> = {
    common: "bg-zinc-700 text-zinc-100",
    rare: "bg-blue-600 text-white",
    epic: "bg-purple-600 text-white",
    legendary: "bg-amber-600 text-white",
  };

  const TYPE_LABELS: Record<string, string> = {
    avatar: "Avatar",
    emoji: "Emoji",
    effect: "Efeito",
    theme: "Tema",
  };

  const filtered =
    filterType === "all"
      ? cosmetics
      : cosmetics.filter((c) => c.type === filterType);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-jaro text-xl text-white">
          {cosmetics.length} cosmético(s)
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
              filterType === "all"
                ? "bg-cyan-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            Todos
          </button>
          {["avatar", "emoji", "effect", "theme"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                filterType === type
                  ? "bg-cyan-500 text-zinc-950"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Panel className="text-center py-12">
          <p className="text-zinc-400 font-mono">Nenhum cosmético encontrado</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cosmetic) => (
            <Panel key={cosmetic.id} className="flex flex-col">
              <div className="text-center mb-4">
                <div className="text-5xl mb-2">{cosmetic.icon}</div>
              </div>

              <div className="space-y-2 flex-1">
                <h3 className="font-jaro text-sm font-bold text-zinc-100">
                  {cosmetic.name}
                </h3>
                <p className="font-mono text-[10px] text-zinc-500">
                  {TYPE_LABELS[cosmetic.type]}
                </p>
                <p className="font-mono text-xs text-zinc-400 line-clamp-2">
                  {cosmetic.description}
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-800 mb-3">
                <Chip
                  tone={
                    cosmetic.rarity === "rare"
                      ? "cyan"
                      : cosmetic.rarity === "epic"
                        ? "violet"
                        : cosmetic.rarity === "legendary"
                          ? "amber"
                          : "zinc"
                  }
                  className="text-xs"
                >
                  {cosmetic.rarity.toUpperCase()}
                </Chip>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex-1 p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-1 font-mono text-xs">
                  <Edit2 size={14} />
                  Editar
                </button>
                <button className="flex-1 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1 font-mono text-xs">
                  <Trash2 size={14} />
                  Remover
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
