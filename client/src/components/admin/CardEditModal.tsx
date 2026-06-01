"use client";

import React, { useState } from "react";
import { Modal } from "./AdminBase";
import { Dice5 } from "lucide-react";

interface Card {
  id?: number;
  tipo: "sorte" | "revés";
  texto: string;
  efeito: "ganhar" | "pagar" | "prisao";
  valor: number;
}

interface CardEditModalProps {
  card: Card | null;
  open: boolean;
  onClose: () => void;
}

const EFEITO_LABELS: Record<string, string> = {
  ganhar: "Ganhar dinheiro",
  pagar: "Pagar dinheiro",
  prisao: "Prisão",
};

export default function CardEditModal({
  card,
  open,
  onClose,
}: CardEditModalProps) {
  const [data, setData] = useState<Card>(card || {
    tipo: "sorte",
    texto: "",
    efeito: "ganhar",
    valor: 0,
  });

  React.useEffect(() => {
    if (card) setData(card);
  }, [card]);

  if (!card) return null;

  const sorte = data.tipo === "sorte";
  const accent = sorte ? "#34d399" : "#fb7185";
  const grad = sorte
    ? "linear-gradient(150deg,#052e2b,#0b3d2e)"
    : "linear-gradient(150deg,#3b0a14,#4c0519)";

  return (
    <Modal open={open} onClose={onClose} width={760}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-jaro text-lg text-white flex items-center gap-2 whitespace-nowrap">
          <Dice5 size={18} className="text-cyan-400" />
          {card.id ? "Editar carta" : "Nova carta"}
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white cursor-pointer p-1"
        >
          ✕
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_260px] gap-5 p-5">
        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
              Tipo
            </label>
            <div className="flex gap-2">
              {(["sorte", "revés"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setData((prev) => ({ ...prev, tipo: t }))}
                  className={`flex-1 px-3 py-2 rounded-lg font-mono text-sm transition-colors ${
                    data.tipo === t
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  {t === "sorte" ? "🍀 Sorte" : "⚠️ Revés"}
                </button>
              ))}
            </div>
          </div>

          {/* Texto */}
          <div>
            <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
              Texto da carta
            </label>
            <textarea
              rows={3}
              value={data.texto}
              onChange={(e) => setData((prev) => ({ ...prev, texto: e.target.value }))}
              placeholder="ex: Avance até o início e receba R$ 2.000."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>

          {/* Efeito & Valor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
                Efeito
              </label>
              <select
                value={data.efeito}
                onChange={(e) =>
                  setData((prev) => ({
                    ...prev,
                    efeito: e.target.value as Card["efeito"],
                  }))
                }
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                {Object.entries(EFEITO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
                Valor
              </label>
              <input
                type="number"
                value={data.valor}
                onChange={(e) =>
                  setData((prev) => ({
                    ...prev,
                    valor: parseInt(e.target.value) || 0,
                  }))
                }
                disabled={data.efeito === "prisao"}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
            Pré-visualização
          </p>
          <div
            className="rounded-2xl border p-5 relative overflow-hidden h-56 flex flex-col"
            style={{
              borderColor: accent + "55",
              background: grad,
              boxShadow: `0 0 50px -22px ${accent}`,
            }}
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ background: accent }} />
            <div className="flex items-center gap-2 relative mb-4">
              <span
                className="w-9 h-9 rounded-lg grid place-items-center text-lg"
                style={{ background: accent + "22", color: accent }}
              >
                {sorte ? "🍀" : "⚠️"}
              </span>
              <span className="font-jaro text-lg" style={{ color: accent }}>
                {sorte ? "SORTE" : "REVÉS"}
              </span>
            </div>
            <p
              className="font-mono text-sm text-zinc-100 leading-snug flex-1 relative"
            >
              {data.texto || "Texto da carta…"}
            </p>
            {data.efeito !== "prisao" && (
              <p className="font-jaro text-xl mt-3 relative" style={{ color: accent }}>
                {data.efeito === "ganhar" ? "+" : "−"} R${" "}
                {data.valor.toLocaleString("pt-BR")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-600 transition-colors font-mono text-sm font-medium"
            >
              {card.id ? "Salvar" : "Criar carta"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 transition-colors font-mono text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
