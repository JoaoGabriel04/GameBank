"use client";

import Modal from "@/components/Modal";
import UserBadge from "@/components/UserBadge";
import PropertyCard from "@/components/Game/sections/ImoveisSection/PropertyCard";
import { formatCurrency } from "@/utils/format";
import { getAccentHex } from "@/components/Game/sections/shared";
import type { Player, SessionPropriedade, Propriedade } from "@/types/game";

type RentItem = {
  sessionProp: SessionPropriedade;
  prop: Propriedade;
};

type RentData = {
  sessionProp: SessionPropriedade;
  prop: Propriedade;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentPlayer: Player | null | undefined;
  currentSession: { jogadores?: Player[]; sessionPosses?: SessionPropriedade[] } | null;
  rentableProps: RentItem[];
  selectedRentProp: number | null;
  setSelectedRentProp: (id: number | null) => void;
  numDados: number;
  setNumDados: (v: number) => void;
  selectedRentData: RentData | null;
  getAluguel: (prop: Propriedade, casas: number) => number;
  handleAluguel: () => void;
  reqLoading: boolean;
};

export default function AluguelModal({
  isOpen, onClose, currentPlayer, currentSession,
  rentableProps, selectedRentProp, setSelectedRentProp,
  numDados, setNumDados, selectedRentData,
  getAluguel, handleAluguel, reqLoading,
}: Props) {
  return (
    <Modal size="md" title="Pagar Aluguel" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
          <span className="text-sm font-inconsolata text-zinc-400">Pagador</span>
          <span className="inline-flex items-center gap-1.5">
            {currentPlayer && <UserBadge badge={currentPlayer.badge} imageUrl={currentPlayer.badgeImageUrl} variant="micro" />}
            <span className="text-sm font-inconsolata text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
          </span>
        </div>

        <div>
          <p className="text-sm font-inconsolata text-zinc-400 mb-2">Propriedade onde caiu</p>
          {rentableProps.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {rentableProps.map((item) => (
                <PropertyCard
                  key={item.sessionProp.id}
                  item={item}
                  selected={selectedRentProp === item.sessionProp.id}
                  onClick={() => {
                    setSelectedRentProp(item.sessionProp.id);
                    setNumDados(0);
                  }}
                  getAluguel={getAluguel}
                  owner={currentSession?.jogadores?.find((j) => j.id === item.sessionProp.playerId)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm font-inconsolata text-zinc-500">Nenhuma propriedade para pagar aluguel no momento.</p>
          )}
        </div>

        {selectedRentData?.prop.tipo === "ação" && (
          <div>
            <p className="text-sm font-inconsolata text-zinc-400 mb-2">Número tirado nos dados</p>
            <input
              type="text"
              inputMode="numeric"
              value={String(numDados)}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, "");
                setNumDados(cleaned ? Number(cleaned) : 0);
              }}
              placeholder="0"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 text-zinc-100 font-inconsolata text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
        )}

        {selectedRentData && (() => {
          const owner = currentSession?.jogadores?.find((j) => j.id === selectedRentData.sessionProp.playerId);
          return (
            <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-inconsolata text-zinc-200">{selectedRentData.prop.nome}</p>
                  <p className="text-xs font-inconsolata text-zinc-500">
                    {selectedRentData.prop.grupo_cor} · {selectedRentData.sessionProp.casas} casa(s)
                  </p>
                  {owner && (
                    <p className="text-[10px] font-inconsolata text-zinc-500 flex items-center gap-1 mt-1">
                      Dono: <UserBadge badge={owner.badge} imageUrl={owner.badgeImageUrl} variant="micro" />
                      <span className="text-zinc-400">{owner.nome}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-inconsolata text-zinc-500">Aluguel</p>
                  <p className="text-lg font-jaro font-semibold" style={{ color: getAccentHex(selectedRentData.prop.grupo_cor) }}>
                    R$ {formatCurrency(getAluguel(selectedRentData.prop, selectedRentData.sessionProp.casas))}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        <button
          onClick={handleAluguel}
          disabled={reqLoading || !currentPlayer || !selectedRentProp}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {reqLoading ? "Pagando..." : "Confirmar Pagamento"}
        </button>
      </div>
    </Modal>
  );
}
