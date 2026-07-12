"use client";

import { getEvento } from "@/constants/eventos";

const CORES: Record<string, string> = {
  verde: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300",
  vermelho: "border-red-500/30 bg-red-500/8 text-red-300",
  amarelo: "border-amber-500/30 bg-amber-500/8 text-amber-300",
  azul: "border-sky-500/30 bg-sky-500/8 text-sky-300",
};

type Props = {
  eventoAtualCodigo?: string | null;
  eventoProximoCodigo?: string | null;
  rodadaAtual?: number;
};

export default function EventoBanner({ eventoAtualCodigo, eventoProximoCodigo, rodadaAtual }: Props) {
  const eventoAtual = getEvento(eventoAtualCodigo);
  const eventoProximo = getEvento(eventoProximoCodigo);

  if (!eventoAtual && !eventoProximo) return null;

  const alvo = eventoAtual ?? eventoProximo;
  const cor = CORES[alvo?.cor ?? "azul"] ?? CORES.azul;
  const prefixo = eventoProximo && !eventoAtual ? "PRÓXIMA:" : "ATIVO:";

  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-2 rounded-lg border font-inconsolata text-xs ${cor}`}>
      <span className="flex items-center gap-1.5 truncate">
        <span className="text-sm leading-none shrink-0">{alvo?.icone}</span>
        <span className="font-semibold shrink-0">{prefixo}</span>
        <span className="truncate">{alvo?.nome}</span>
      </span>
      {rodadaAtual != null && (
        <span className="shrink-0 text-zinc-500">
          R{String(rodadaAtual).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
