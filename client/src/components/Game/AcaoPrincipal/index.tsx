"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHourglassHalf, faBan, faDice } from "@fortawesome/free-solid-svg-icons";
import { useGameStore } from "@/stores/gameStore";

type Props = {
  meuPlayerId?: number;
};

export default function AcaoPrincipal({ meuPlayerId }: Props) {
  const currentSession = useGameStore((s) => s.currentSession);
  if (!currentSession) return null;

  const minhaVez = !!meuPlayerId && currentSession.turnoAtualPlayerId === meuPlayerId;

  let label = "Sua vez — role os dados no banner acima";
  let icone = faDice;
  let cor = "text-green-400 border-green-500/30 bg-green-500/5";

  if (currentSession.aguardandoEscolha) {
    label = "Escolha o movimento no modal";
    icone = faHourglassHalf;
    cor = "text-amber-300 border-amber-500/30 bg-amber-500/5";
  } else if (currentSession.aguardandoAcao) {
    label = "Aguardando ação...";
    icone = faHourglassHalf;
    cor = "text-zinc-400 border-zinc-700 bg-zinc-900";
  } else if (!minhaVez) {
    label = "Aguardando vez...";
    icone = faBan;
    cor = "text-zinc-500 border-zinc-700 bg-zinc-900";
  }

  return (
    <div className="px-4">
      <div className={`w-full py-3 rounded-xl border font-jaro text-sm tracking-wider text-center select-none ${cor}`}>
        <FontAwesomeIcon icon={icone} className="mr-2" />
        {label}
      </div>
    </div>
  );
}
