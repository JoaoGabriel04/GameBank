"use client";

import { useState } from "react";
import { Panel, PanelHead } from "@/components/admin/AdminBase";
import { DollarSign, Save } from "lucide-react";

export default function AdminEconomyPage() {
  const [config, setConfig] = useState({
    initialBalance: 10000,
    xpMultiplier: 1.0,
    coinMultiplier: 1.0,
    houseCostMultiplier: 1.0,
  });

  const handleChange = (field: string, value: number) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <Panel flush>
        <PanelHead
          title="Configurações de economia"
          icon={DollarSign}
          sub="Saldos, multiplicadores e valores do sistema"
        />

        <div className="divide-y divide-zinc-800">
          {/* Initial Balance */}
          <div className="p-6 space-y-2">
            <label className="block">
              <span className="font-mono text-xs uppercase text-zinc-500 mb-2 block">
                Saldo inicial (R$)
              </span>
              <input
                type="number"
                value={config.initialBalance}
                onChange={(e) =>
                  handleChange("initialBalance", parseFloat(e.target.value))
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <p className="font-mono text-[10px] text-zinc-600 mt-1">
                Cada jogador começa com R${" "}
                {config.initialBalance.toLocaleString("pt-BR")}
              </p>
            </label>
          </div>

          {/* Multipliers */}
          <div className="p-6 space-y-4">
            <h3 className="font-jaro text-sm font-bold text-zinc-300">
              Multiplicadores
            </h3>

            <label className="block">
              <span className="font-mono text-xs uppercase text-zinc-500 mb-2 block">
                Multiplicador XP
              </span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={config.xpMultiplier}
                onChange={(e) =>
                  handleChange("xpMultiplier", parseFloat(e.target.value))
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <p className="font-mono text-[10px] text-zinc-600 mt-1">
                {config.xpMultiplier}x de XP por vitória
              </p>
            </label>

            <label className="block">
              <span className="font-mono text-xs uppercase text-zinc-500 mb-2 block">
                Multiplicador Moedas
              </span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={config.coinMultiplier}
                onChange={(e) =>
                  handleChange("coinMultiplier", parseFloat(e.target.value))
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <p className="font-mono text-[10px] text-zinc-600 mt-1">
                {config.coinMultiplier}x de moedas por vitória
              </p>
            </label>

            <label className="block">
              <span className="font-mono text-xs uppercase text-zinc-500 mb-2 block">
                Multiplicador Custo Imóvel
              </span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={config.houseCostMultiplier}
                onChange={(e) =>
                  handleChange("houseCostMultiplier", parseFloat(e.target.value))
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <p className="font-mono text-[10px] text-zinc-600 mt-1">
                {config.houseCostMultiplier}x do custo base dos imóveis
              </p>
            </label>
          </div>

          {/* Summary */}
          <div className="p-6">
            <h3 className="font-jaro text-sm font-bold text-zinc-300 mb-3">
              Resumo
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="font-mono text-xs text-zinc-500 mb-1">
                  Saldo Inicial
                </p>
                <p className="font-jaro text-lg text-cyan-400">
                  R$ {config.initialBalance.toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="font-mono text-xs text-zinc-500 mb-1">
                  Ganho Esperado
                </p>
                <p className="font-jaro text-lg text-emerald-400">
                  {(config.xpMultiplier * config.coinMultiplier).toFixed(2)}x
                </p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button className="flex-1 px-4 py-2 rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-600 transition-colors font-mono text-sm font-medium flex items-center justify-center gap-2">
          <Save size={16} />
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}
