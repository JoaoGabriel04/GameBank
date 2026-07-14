"use client";

import { useMemo } from "react";
import { useGameStore } from "@/stores/gameStore";
import type { Transacao } from "@/types/game";
import { formatCurrency } from "@/utils/format";
import { Home, Landmark, Gift, Ban, ArrowLeftToLine, Shield, Gavel, TrendingUp } from "lucide-react";

const TIPOS_RELEVANTES = new Set([
  "PAGAMENTO_ALUGUEL", "COMPRA_PROPRIEDADE", "PASSAGEM_INICIO",
  "SORTE_REVES", "IMPOSTO", "RESTITUICAO", "PRISAO", "LEILAO", "RENDA_PASSIVA",
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
    case "RENDA_PASSIVA": return <TrendingUp className="w-3.5 h-3.5" />;
    default: return <TrendingUp className="w-3.5 h-3.5" />;
  }
}

// Pega o ÚLTIMO valor "R$ ..." mencionado em `detalhes` (heurística: em
// mensagens com um resumo final tipo "... = R$ +395", esse é o total
// líquido; em mensagens com um único valor, é o próprio valor). O sinal
// (+/−) precisa fazer parte da classe de caracteres do regex — sem isso,
// um trecho como "R$ +395" simplesmente não casa e o match cai de volta
// pro penúltimo valor da string (ex.: a parcela de IPTU), resultando num
// valor e sinal completamente errados.
function extrairValor(detalhes: string): { valor: number; sinal: "+" | "-" | null } | null {
  const matches = detalhes.match(/R\$ ?([+−-]?[0-9.]+)/g);
  if (!matches || matches.length === 0) return null;
  const lastRaw = matches[matches.length - 1].replace("R$", "").trim();
  const sinal = lastRaw.startsWith("+") ? "+" : lastRaw.startsWith("−") || lastRaw.startsWith("-") ? "-" : null;
  const valor = parseFloat(lastRaw.replace(/^[+−-]/, "").replace(/\./g, ""));
  if (isNaN(valor)) return null;
  return { valor, sinal };
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
    // `historico` chega em ordem cronológica crescente (mais antigo
    // primeiro — session.repository.ts inclui a relação sem orderBy).
    // slice(-5) pega os 5 mais recentes; reverse() mostra o mais novo no
    // topo, que é o sentido de "últimas jogadas".
    return historico
      .filter((h) => TIPOS_RELEVANTES.has(h.tipo))
      .slice(-5)
      .reverse();
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
          const extraido = extrairValor(h.detalhes);
          const valor = extraido?.valor ?? null;
          // Prioriza o sinal do próprio valor extraído (mais confiável que
          // a heurística por tipo/palavras-chave abaixo) — ex.: um
          // PASSAGEM_INICIO com líquido negativo (IPTU > crédito) precisa
          // aparecer em vermelho, não sempre em verde.
          const positivo = extraido?.sinal ? extraido.sinal === "+" : isPositive(h.detalhes, h.tipo);
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
