"use client";

import { Minus, Plus, LoaderCircle } from "lucide-react";
import Modal from "@/components/Modal";
import { formatCurrency } from "@/utils/format";
import { getAccentHex, COLOR_LABELS } from "@/components/Game/sections/shared";
import type { PropItem } from "@/utils/properties";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  myProps: PropItem[];
  propertyGroups: { cor: string; items: PropItem[] }[];
  sellQuantities: Record<number, number>;
  setSellQty: (sessionPossesId: number, qty: number) => void;
  handleBatchSell: () => void;
  reqLoading: boolean;
};

export default function VenderCasasModal({
  isOpen, onClose, myProps, propertyGroups, sellQuantities,
  setSellQty, handleBatchSell, reqLoading,
}: Props) {
  return (
    <Modal size="lg" title="Vender Casas" isOpen={isOpen} onClose={() => { onClose(); }}>
      <div className="space-y-6">
        {myProps.length === 0 ? (
          <p className="text-sm font-inconsolata text-zinc-500 italic text-center py-8">
            Nenhuma propriedade com casas para vender.
          </p>
        ) : (
          propertyGroups.map((group) => {
            const propsComCasas = group.items.filter((item) => item.sessionProp.casas > 0);
            if (!propsComCasas.length) return null;
            const accent = getAccentHex(group.cor);
            return (
              <div key={group.cor}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                  <h3 className="text-sm font-jaro text-zinc-300 uppercase tracking-wide">
                    {COLOR_LABELS[group.cor] || group.cor}
                  </h3>
                </div>
                <div className="space-y-2">
                  {propsComCasas.map(({ prop, sessionProp }) => {
                    const qty = sellQuantities[sessionProp.id] ?? 0;
                    return (
                      <div
                        key={sessionProp.id}
                        className="flex items-center gap-3 p-3 bg-zinc-800/60 border border-zinc-700 rounded-xl"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-inconsolata text-zinc-200 truncate">{prop.nome}</p>
                          <p className="text-xs font-inconsolata text-zinc-500">
                            {sessionProp.casas} casa{sessionProp.casas !== 1 ? "s" : ""} · R$ {formatCurrency(prop.custo_casa)} cada
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSellQty(sessionProp.id, qty - 1)}
                            disabled={qty <= 0}
                            className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-zinc-200 cursor-pointer transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-jaro text-orange-400">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setSellQty(sessionProp.id, qty + 1)}
                            disabled={qty >= sessionProp.casas}
                            className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-zinc-200 cursor-pointer transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {Object.values(sellQuantities).some((q) => q > 0) && (
          <div className="border-t border-zinc-800 pt-4 space-y-4">
            <div className="flex items-center justify-between text-sm font-inconsolata">
              <span className="text-zinc-400">Total a receber</span>
              <span className="text-lg font-jaro text-green-400">
                R$ {formatCurrency(
                  Object.entries(sellQuantities)
                    .filter(([, qty]) => qty > 0)
                    .reduce((sum, [id, qty]) => {
                      const prop = myProps.find((p) => p.sessionProp.id === Number(id));
                      return sum + (prop ? prop.prop.custo_casa * qty : 0);
                    }, 0)
                )}
              </span>
            </div>
            <button
              onClick={handleBatchSell}
              disabled={reqLoading || !Object.values(sellQuantities).some((q) => q > 0)}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {reqLoading ? (
                <><LoaderCircle className="w-5 h-5 animate-spin" /> Vendendo...</>
              ) : (
                "Confirmar Venda"
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
