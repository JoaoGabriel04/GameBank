"use client";

import { Check, LoaderCircle } from "lucide-react";
import Modal from "@/components/Modal";
import { formatCurrency } from "@/utils/format";
import { getAccentHex, COLOR_LABELS } from "@/components/Game/sections/shared";
import type { PropItem } from "@/utils/properties";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  completedColorGroups: { cor: string; items: PropItem[] }[];
  selectedBatchProps: number[];
  toggleBatchProp: (id: number) => void;
  custoCasaAtual: (custoBase: number) => number;
  handleBatchBuy: () => void;
  reqLoading: boolean;
  custoConstrucaoMult: number;
};

export default function ComprarCasasModal({
  isOpen, onClose,   completedColorGroups, selectedBatchProps,
  toggleBatchProp, custoCasaAtual, handleBatchBuy, reqLoading, custoConstrucaoMult,
}: Props) {
  return (
    <Modal size="lg" title="Comprar Casas" isOpen={isOpen} onClose={() => { onClose(); }}>
      <div className="space-y-6">
        {completedColorGroups.length === 0 ? (
          <p className="text-sm font-inconsolata text-zinc-500 italic text-center py-8">
            Você precisa ter um grupo de cor completo para comprar casas.
          </p>
        ) : (
          completedColorGroups.map((group) => {
            const accent = getAccentHex(group.cor);
            return (
              <div key={group.cor}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                  <h3 className="text-sm font-jaro text-zinc-300 uppercase tracking-wide">
                    {COLOR_LABELS[group.cor] || group.cor}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.items.map(({ prop, sessionProp }) => {
                    const isMax = sessionProp.casas >= 5;
                    const selected = selectedBatchProps.includes(sessionProp.id);
                    return (
                      <button
                        key={sessionProp.id}
                        type="button"
                        onClick={() => !isMax && toggleBatchProp(sessionProp.id)}
                        disabled={isMax}
                        className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                          isMax
                            ? "border-zinc-700/50 bg-zinc-800/30 opacity-50 cursor-not-allowed"
                            : selected
                              ? "border-teal-500 bg-teal-500/10 shadow-[0_0_12px_rgba(20,184,166,0.15)]"
                              : "border-zinc-700 bg-zinc-800/60 hover:border-zinc-500"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                            isMax
                              ? "border-zinc-600 bg-zinc-700/50"
                              : selected
                                ? "border-teal-400 bg-teal-500"
                                : "border-zinc-600 bg-zinc-800"
                          }`}
                        >
                          {isMax ? (
                            <span className="text-[10px] font-inconsolata text-zinc-500">5</span>
                          ) : selected ? (
                            <Check className="w-4 h-4 text-white" />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-inconsolata text-zinc-200 truncate">{prop.nome}</p>
                          <p className="text-xs font-inconsolata text-zinc-500">
                            {sessionProp.casas}/5 casas ·{" "}
                            {custoConstrucaoMult !== 1 && (
                              <span className="line-through text-zinc-600 mr-1">R$ {formatCurrency(prop.custo_casa)}</span>
                            )}
                            <span className={custoConstrucaoMult > 1 ? "text-red-400" : custoConstrucaoMult < 1 ? "text-emerald-400" : ""}>
                              R$ {formatCurrency(custoCasaAtual(prop.custo_casa))}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-sm ${i < sessionProp.casas ? "" : "opacity-20"}`}
                              style={{ backgroundColor: i < sessionProp.casas ? accent : "#52525b" }}
                            />
                          ))}
                        </div>
                        {isMax && (
                          <span className="absolute -top-1.5 -right-1.5 text-[10px] font-inconsolata bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">
                            Máximo
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {completedColorGroups.length > 0 && (
          <div className="border-t border-zinc-800 pt-4 space-y-4">
            <div className="flex items-center justify-between text-sm font-inconsolata">
              <span className="text-zinc-400">
                {selectedBatchProps.length} propriedade{selectedBatchProps.length !== 1 ? "s" : ""} selecionada{selectedBatchProps.length !== 1 ? "s" : ""}
              </span>
              <span className="text-lg font-jaro text-teal-400">
                R$ {formatCurrency(
                  completedColorGroups
                    .flatMap((g) => g.items)
                    .filter((item) => selectedBatchProps.includes(item.sessionProp.id))
                    .reduce((sum, item) => sum + custoCasaAtual(item.prop.custo_casa), 0)
                )}
              </span>
            </div>
            <button
              onClick={handleBatchBuy}
              disabled={reqLoading || selectedBatchProps.length === 0}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {reqLoading ? (
                <><LoaderCircle className="w-5 h-5 animate-spin" /> Comprando...</>
              ) : (
                "Confirmar Compra"
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
