"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHead, Chip } from "@/components/admin/AdminBase";
import { ShopItem } from "@/lib/admin/types";
import { Store, Plus, Edit2, Trash2 } from "lucide-react";

export default function AdminShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const mockItems: ShopItem[] = [
        {
          id: 1,
          name: "Coroa Dourada",
          description: "Título exclusivo de prestígio",
          type: "title",
          price: 5000,
          icon: "👑",
          value: "GOLDEN_CROWN",
          createdAt: "2024-01-15",
          sales: 42,
        },
        {
          id: 2,
          name: "Badge Campeão",
          description: "Badge para vencedores de torneios",
          type: "badge",
          price: 2500,
          icon: "🏆",
          value: "CHAMPION_BADGE",
          createdAt: "2024-01-10",
          sales: 87,
        },
        {
          id: 3,
          name: "Título Premium",
          description: "Acesso a salas VIP",
          type: "title",
          price: 7500,
          icon: "⭐",
          value: "PREMIUM_TITLE",
          createdAt: "2024-01-20",
          sales: 23,
        },
      ];
      setItems(mockItems);
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
        <h2 className="font-jaro text-xl text-white">{items.length} itens na loja</h2>
        <button className="px-3 py-2 rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-600 transition-colors font-mono text-sm flex items-center gap-2">
          <Plus size={16} />
          Novo Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <Panel key={item.id} className="flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="text-3xl">{item.icon}</div>
              <Chip tone={item.type === "title" ? "cyan" : "violet"}>
                {item.type === "title" ? "Título" : "Badge"}
              </Chip>
            </div>

            <h3 className="font-jaro text-base text-white mb-1">{item.name}</h3>
            <p className="font-mono text-xs text-zinc-500 mb-3 flex-1">
              {item.description}
            </p>

            <div className="border-t border-zinc-800 pt-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-zinc-500">Preço</span>
                <span className="font-jaro text-lg text-amber-400">
                  {item.price === 0 ? "Gratuito" : `R$ ${item.price.toLocaleString("pt-BR")}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500">Vendas</span>
                <span className="font-jaro text-lg text-emerald-400">
                  {item.sales || 0}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex-1 p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors font-mono text-xs flex items-center justify-center gap-1">
                <Edit2 size={14} />
                Editar
              </button>
              <button className="flex-1 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-mono text-xs flex items-center justify-center gap-1">
                <Trash2 size={14} />
                Remover
              </button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
