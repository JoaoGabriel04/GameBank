"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHead, Chip } from "@/components/admin/AdminBase";
import CardEditModal from "@/components/admin/CardEditModal";
import { GameCard } from "@/lib/admin/types";
import { Dice5, Plus, Edit2, Trash2 } from "lucide-react";

export default function AdminCardsPage() {
  const [cards, setCards] = useState<GameCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<any>(null);

  async function load() {
    setLoading(true);
    try {
      const mockCards: GameCard[] = [
        {
          id: 1,
          texto: "Ganhe R$ 500 na próxima venda",
          tipo: "ganhar_dinheiro",
          valor: 500,
          baralho: "sorte",
        },
        {
          id: 2,
          texto: "Perca R$ 300 com danos",
          tipo: "perder_dinheiro",
          valor: 300,
          baralho: "reves",
        },
        {
          id: 3,
          texto: "Receba bônus de todos os jogadores",
          tipo: "receber_jogadores",
          valor: 100,
          baralho: "sorte",
        },
        {
          id: 4,
          texto: "Pague multa para cada jogador",
          tipo: "pagar_jogadores",
          valor: 150,
          baralho: "reves",
        },
      ];
      setCards(mockCards);
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

  const TYPE_DISPLAY: Record<string, string> = {
    ganhar_dinheiro: "💰 Ganhar Dinheiro",
    perder_dinheiro: "💸 Perder Dinheiro",
    receber_jogadores: "👥 Receber",
    pagar_jogadores: "👥 Pagar",
  };

  const baraTheme = (b: string) =>
    b === "sorte"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
      : "bg-red-500/10 text-red-300 border-red-500/30";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-jaro text-xl text-white">{cards.length} cartas no baralho</h2>
        <button className="px-3 py-2 rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-600 transition-colors font-mono text-sm flex items-center gap-2">
          <Plus size={16} />
          Nova Carta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Panel key={card.id} className="flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">
                {card.baralho === "sorte" ? "🍀" : "⚠️"}
              </span>
              <Chip
                tone={card.baralho === "sorte" ? "emerald" : "rose"}
                className="text-[10px]"
              >
                {card.baralho === "sorte" ? "SORTE" : "REVÉS"}
              </Chip>
            </div>

            <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900 rounded-lg p-4 mb-3 border border-zinc-700">
              <p className="font-jaro text-sm text-zinc-100 text-center leading-relaxed">
                {card.texto}
              </p>
            </div>

            <div className="border-t border-zinc-800 pt-3 mb-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500">Tipo</span>
                <span className="font-mono text-xs text-zinc-300">
                  {TYPE_DISPLAY[card.tipo] || card.tipo}
                </span>
              </div>
              {[
                "ganhar_dinheiro",
                "perder_dinheiro",
                "receber_jogadores",
                "pagar_jogadores",
              ].includes(card.tipo) && (
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-xs text-zinc-500">Valor</span>
                  <span className="font-jaro text-sm text-amber-400">
                    R$ {card.valor}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setSelectedCard({
                    id: card.id,
                    tipo: card.baralho === "sorte" ? "sorte" : "revés",
                    texto: card.texto,
                    efeito: "ganhar",
                    valor: card.valor,
                  })
                }
                className="flex-1 p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors font-mono text-xs flex items-center justify-center gap-1"
              >
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

      <CardEditModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}
