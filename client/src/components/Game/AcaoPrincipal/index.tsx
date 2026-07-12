"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDice, faHourglassHalf, faBan } from "@fortawesome/free-solid-svg-icons";
import { useGameStore } from "@/stores/gameStore";

type Props = {
  meuPlayerId?: number;
  rolando: boolean;
  onRolarDados: () => void;
};

export default function AcaoPrincipal({ meuPlayerId, rolando, onRolarDados }: Props) {
  const currentSession = useGameStore((s) => s.currentSession);
  if (!currentSession) return null;

  const minhaVez = !!meuPlayerId && currentSession.turnoAtualPlayerId === meuPlayerId;

  const desabilitado = rolando || !!currentSession.aguardandoAcao || !!currentSession.aguardandoEscolha;

  let label = "Rolar Dados";
  let icone = faDice;
  let cor = "bg-blue-600 hover:bg-blue-500";

  if (currentSession.aguardandoEscolha) {
    label = "Escolha o movimento";
    icone = faHourglassHalf;
    cor = "bg-amber-600 hover:bg-amber-500";
  } else if (currentSession.aguardandoAcao) {
    label = "Aguardando ação...";
    icone = faHourglassHalf;
    cor = "bg-zinc-700 cursor-not-allowed";
  } else if (!minhaVez) {
    label = "Aguardando vez...";
    icone = faBan;
    cor = "bg-zinc-700 cursor-not-allowed";
    // Não permite clique
    return (
      <div className="px-4">
        <div className="w-full py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-500 font-jaro text-sm text-center cursor-not-allowed select-none">
          <FontAwesomeIcon icon={icone} className="mr-2" />
          {label}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <button
        onClick={desabilitado ? undefined : onRolarDados}
        disabled={desabilitado}
        className={`w-full py-3 rounded-xl text-white font-jaro text-sm tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${cor} active:scale-[0.98]`}
      >
        <FontAwesomeIcon icon={icone} className="mr-2" />
        {rolando ? "Rolando..." : label}
      </button>
    </div>
  );
}
