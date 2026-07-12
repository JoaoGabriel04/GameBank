"use client";

import { useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import BoardPanel from "@/components/Game/BoardPanel";
import BoardModal from "@/components/Game/BoardModal";
import EventoBanner from "@/components/Game/EventoBanner";
import TurnoTimeline from "@/components/Game/TurnoTimeline";
import AcaoPrincipal from "@/components/Game/AcaoPrincipal";
import StatsRapidas from "@/components/Game/StatsRapidas";
import { LoaderCircle } from "lucide-react";

type Props = {
  rolando: boolean;
  onRolarDados: () => void;
};
export default function GameShell({ rolando, onRolarDados }: Props) {
  const currentSession = useGameStore((s) => s.currentSession);
  const { user: authUser } = useAuthStore();
  const [boardModalOpen, setBoardModalOpen] = useState(false);

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderCircle className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  const currentPlayer = currentSession.jogadores?.find(
    (p) => p.userId === authUser?.id
  );
  const meuPlayerId = currentPlayer?.id;
  const isTabuleiro = currentSession.tipoJogo === "tabuleiro";

  // Modo Banca: mostra apenas as stats rápidas (não mexe em nada do layout)
  if (!isTabuleiro) {
    return (
      <div className="space-y-3">
        <StatsRapidas meuPlayerId={meuPlayerId} />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 pb-4">
        {/* Board compacto — ~45% altura, com botão de maximizar */}
        <BoardPanel
          session={currentSession}
          meuPlayerId={meuPlayerId}
          onMaximize={() => setBoardModalOpen(true)}
        />

        {/* Faixa do evento econômico */}
        <EventoBanner
          eventoAtualCodigo={currentSession.eventoAtual}
          eventoProximoCodigo={currentSession.eventoProximo}
          rodadaAtual={currentSession.rodadaAtual}
        />

        {/* Timeline de turno */}
        <TurnoTimeline meuPlayerId={meuPlayerId} />

        {/* Ação principal contextual */}
        <AcaoPrincipal
          meuPlayerId={meuPlayerId}
          rolando={rolando}
          onRolarDados={onRolarDados}
        />

        {/* Stats rápidas */}
        <StatsRapidas meuPlayerId={meuPlayerId} />
      </div>

      {/* Board modal — maximizado, só visualização */}
      {boardModalOpen && (
        <BoardModal
          session={currentSession}
          meuPlayerId={meuPlayerId}
          isOpen={boardModalOpen}
          onClose={() => setBoardModalOpen(false)}
        />
      )}
    </>
  );
}
