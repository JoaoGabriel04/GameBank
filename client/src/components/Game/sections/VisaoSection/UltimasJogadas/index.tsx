"use client";

import { useMemo } from "react";
import { useGameStore } from "@/stores/gameStore";
import type { Transacao } from "@/types/game";
import { formatCurrency } from "@/utils/format";
import { Home, Landmark, Gift, Ban, ArrowLeftToLine, Shield, Gavel, TrendingUp } from "lucide-react";

const TIPOS_RELEVANTES = new Set([
  "PAGAMENTO_ALUGUEL", "COMPRA_PROPRIEDADE", "PASSAGEM_INICIO",
  "SORTE_REVES", "IMPOSTO", "RESTITUICAO", "PRISAO", "LEILAO",
]);

function getTipoIcon(tipo: string) {
  switch (tipo) {
    case "PAGAMENTO_ALUGUEL": return <Home className="w-3.5 h-3.5" />;
    case "COMPRA_PROPRIEDADE": return <Landmark className="w-3.5 h-3.5" />;
    case "PASSAGEM_INICIO": return <ArrowLeftToLine className="w-3.5 h-3.5" />;
    case "SORTE_REVES": return <Gift className="w-3.5 h-3.5" />;
    case "IMPOSTO": return <Ban className="w-3.5 h-3.5" />;
    case "RESTITUICAO": return <TrendingUp className="w-3.5 h-3.5" />;
    case "PRISAO": return <Shield className="w-3.5 h-3.5" />;
    case "LEILAO": return <Gavel className="w-3.5 h-3.5" />;
    default: return <TrendingUp className="w-3.5 h-3.5" />;
  }
}

function extrairValor(detalhes: string): number | null {
  const matches = detalhes.match(/R\$ ?([0-9.]+)/g);
  if (!matches || matches.length === 0) return null;
  const lastRaw = matches[matches.length - 1];
  const valor = parseFloat(lastRaw.replace("R$", "").replace(/\./g, "").trim());
  if (isNaN(valor)) return null;
  return valor;
}

function isPositive(detalhes: string, tipo: string): boolean {
  const lower = detalhes.toLowerCase();
  if (lower.includes("recebeu") || lower.includes("vendeu") || lower.includes("restituição") || lower.includes("crédito") || lower.includes("arrematou") || lower.includes("+r$")) return true;
  if (tipo === "PASSAGEM_INICIO" || tipo === "RESTITUICAO") return true;
  return false;
}

type Props = {
  historico: Transacao[];
};

export default function UltimasJogadas({ historico }: Props) {
  const ultimas = useMemo(() => {
    return historico
      .filter((h) => TIPOS_RELEVANTES.has(h.tipo))
      .slice(0, 5);
  }, [historico]);

  if (ultimas.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-xs font-jaro text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <TrendingUp className="w-3 h-3 text-zinc-500" />
        Últimas jogadas
      </h3>
      <div className="space-y-2">
        {ultimas.map((h) => {
          const valor = extrairValor(h.detalhes);
          const positivo = isPositive(h.detalhes, h.tipo);
          return (
            <div key={h.id} className="flex items-start gap-2.5 text-xs font-inconsolata">
              <span className={`shrink-0 mt-0.5 ${
                positivo ? "text-green-400" : "text-red-400"
              }`}>
                {getTipoIcon(h.tipo)}
              </span>
              <span className="text-zinc-400 flex-1 leading-snug">{h.detalhes}</span>
              {valor !== null && (
                <span className={`shrink-0 font-semibold tabular-nums ${
                  positivo ? "text-green-400" : "text-red-400"
                }`}>
                  {positivo ? "+" : "−"}R$ {formatCurrency(valor)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
