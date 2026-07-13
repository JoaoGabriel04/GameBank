"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHourglassHalf, faDice } from "@fortawesome/free-solid-svg-icons";
import { serverNow } from "@/utils/clock";

type Props = {
  meuPlayerId?: number;
};

export default function TurnoTimeline({ meuPlayerId }: Props) {
  const currentSession = useGameStore((s) => s.currentSession);
  const [restante, setRestante] = useState(60);

  if (!currentSession) return null;

  const ordem: number[] = currentSession.ordemTurnos
    ? JSON.parse(currentSession.ordemTurnos)
    : [];
  const jogadores = currentSession.jogadores ?? [];
  const turnoAtualPlayerId = currentSession.turnoAtualPlayerId;
  const idxAtual = turnoAtualPlayerId ? ordem.indexOf(turnoAtualPlayerId) : -1;

  const anterior = idxAtual > 0 ? ordem[idxAtual - 1] : null;
  const proximo = idxAtual >= 0 && idxAtual < ordem.length - 1 ? ordem[idxAtual + 1] : null;

  const jogadorAnterior = jogadores.find((p) => p.id === anterior);
  const jogadorAtual = jogadores.find((p) => p.id === turnoAtualPlayerId);
  const jogadorProximo = jogadores.find((p) => p.id === proximo);

  const minhaVez = !!meuPlayerId && turnoAtualPlayerId === meuPlayerId;

  useEffect(() => {
    // FIX_TURNO_TRAVADO_CONTADOR (BUG B.4): null não pode deixar o contador
    // congelado no valor da rodada anterior — zera explicitamente.
    if (!currentSession.turnoIniciadoEm) {
      setRestante(0);
      return;
    }
    const inicio = new Date(currentSession.turnoIniciadoEm).getTime();
    const tick = () => {
      // FIX_TURNO_TRAVADO_CONTADOR (BUG B.3): serverNow(), não Date.now() —
      // turnoIniciadoEm é hora do SERVIDOR; comparar direto com o relógio
      // do cliente trava o contador em 0 se ele estiver adiantado.
      const passado = Math.floor((serverNow() - inicio) / 1000);
      setRestante(Math.max(0, 60 - passado));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [currentSession.turnoIniciadoEm, currentSession.turnoAtualPlayerId]);

  const rodada = currentSession.rodadaAtual ?? 1;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 bg-zinc-900/60 border border-zinc-800 rounded-lg">
      {/* Anterior */}
      <div className="flex-1 text-right min-w-0">
        {jogadorAnterior ? (
          <span className="text-[11px] font-inconsolata text-zinc-500 truncate block">
            {jogadorAnterior.nome}
          </span>
        ) : (
          <span className="text-[11px] font-inconsolata text-zinc-600">—</span>
        )}
      </div>

      {/* Atual */}
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-full border font-inconsolata text-xs font-semibold shrink-0 ${
          minhaVez
            ? "border-green-500/50 bg-green-500/15 text-green-300"
            : "border-zinc-700 bg-zinc-800 text-zinc-300"
        }`}
      >
        {minhaVez ? (
          <>
            <FontAwesomeIcon icon={faDice} className="text-green-400" />
            <span>SUA VEZ</span>
            <span className="text-zinc-400">{restante}s</span>
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faHourglassHalf} className="text-zinc-500" />
            <span className="truncate max-w-[80px]">{jogadorAtual?.nome ?? "—"}</span>
          </>
        )}
      </div>

      {/* Próximo */}
      <div className="flex-1 text-left min-w-0">
        {jogadorProximo ? (
          <span className="text-[11px] font-inconsolata text-zinc-500 truncate block">
            {jogadorProximo.nome}
          </span>
        ) : (
          <span className="text-[11px] font-inconsolata text-zinc-600">—</span>
        )}
      </div>

      {/* Rodada */}
      <span className="text-[10px] font-inconsolata text-zinc-600 shrink-0 ml-1">
        R{String(rodada).padStart(2, "0")}
      </span>
    </div>
  );
}
