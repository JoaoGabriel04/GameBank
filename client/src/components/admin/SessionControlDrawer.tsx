"use client";

import React, { useState } from "react";
import { Drawer } from "./AdminBase";
import { LiveSession } from "@/lib/admin/types";
import { Pause, Play, X, Edit2, Plus, Minus } from "lucide-react";

interface SessionControlDrawerProps {
  session: LiveSession | null;
  open: boolean;
  onClose: () => void;
}

export default function SessionControlDrawer({
  session,
  open,
  onClose,
}: SessionControlDrawerProps) {
  const [players, setPlayers] = useState<typeof session["jogadores"]>(
    session?.jogadores || []
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  React.useEffect(() => {
    if (session) {
      setPlayers(session.jogadores);
    }
  }, [session]);

  if (!session) return null;

  const totalSaldo = players.reduce((sum, j) => sum + j.saldo, 0);
  const maxSaldo = Math.max(...players.map((j) => j.saldo), 1);

  const handleEditSaldo = (playerId: number, currentSaldo: number) => {
    setEditingId(playerId);
    setEditValue(currentSaldo);
  };

  const handleSaveSaldo = (playerId: number) => {
    setPlayers((prev) =>
      prev.map((j) =>
        j.id === playerId ? { ...j, saldo: Math.max(0, editValue) } : j
      )
    );
    setEditingId(null);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title={session.nome}
      icon={undefined}
    >
      <div className="p-5 space-y-5">
        {/* Session Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {session.status}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase tracking-wider bg-zinc-700/30 text-zinc-400 border-zinc-600/40">
            #{session.id}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase tracking-wider bg-zinc-700/30 text-zinc-400 border-zinc-600/40 capitalize">
            {session.modo}
          </span>
          <span className="font-mono text-[11px] text-zinc-500 ml-auto">
            {Math.floor(session.duracao / 60)}min
          </span>
        </div>

        {/* Live Controls */}
        {session.status === "Em Andamento" && (
          <div className="grid grid-cols-3 gap-2">
            <button className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors font-mono text-xs">
              <Pause size={14} />
              Pausar
            </button>
            <button className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors font-mono text-xs">
              <Play size={14} />
              Resumir
            </button>
            <button className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors font-mono text-xs">
              <X size={14} />
              Encerrar
            </button>
          </div>
        )}

        {/* Bank Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Em jogo
            </p>
            <p className="font-jaro text-lg text-emerald-400 mt-1">
              R$ {totalSaldo.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Líder
            </p>
            <p className="font-mono text-sm text-zinc-100 mt-1 truncate">
              {players.reduce((m, j) => (j.saldo > m.saldo ? j : m), players[0])
                ?.nome || "—"}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Ativos
            </p>
            <p className="font-jaro text-lg text-white mt-1">
              {players.length}
            </p>
          </div>
        </div>

        {/* Players Control */}
        <div>
          <h4 className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
            Jogadores · controle do banco
          </h4>
          <div className="space-y-2">
            {players.map((j) => (
              <div
                key={j.id}
                className="border border-zinc-800 bg-zinc-900 rounded-xl p-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-full ring-1 ring-white/10 shrink-0"
                    style={{ background: j.cor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-zinc-100 truncate">
                      {j.nome}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      Saldo current
                    </p>
                  </div>

                  {editingId === j.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) =>
                          setEditValue(parseInt(e.target.value) || 0)
                        }
                        className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={() => handleSaveSaldo(j.id)}
                        className="p-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded-lg bg-zinc-700 text-zinc-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEditSaldo(j.id, j.saldo)}
                      className="text-right group cursor-pointer shrink-0"
                    >
                      <span className="font-jaro text-base text-emerald-400 group-hover:text-emerald-300">
                        R$ {j.saldo.toLocaleString("pt-BR")}
                      </span>
                      <span className="flex items-center gap-1 justify-end font-mono text-[9px] text-zinc-600 group-hover:text-cyan-400">
                        <Edit2 size={10} />
                        editar
                      </span>
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-2 bg-zinc-800 rounded-full h-1">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all"
                    style={{ width: `${(j.saldo / maxSaldo) * 100}%` }}
                  />
                </div>

                {/* Quick adjust buttons */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[1000, 5000].map((v) => (
                    <button
                      key={`add-${v}`}
                      onClick={() => {
                        setPlayers((prev) =>
                          prev.map((p) =>
                            p.id === j.id
                              ? { ...p, saldo: p.saldo + v }
                              : p
                          )
                        );
                      }}
                      className="font-mono text-[10px] px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                    >
                      +{(v / 1000).toFixed(0)}k
                    </button>
                  ))}
                  {[1000, 5000].map((v) => (
                    <button
                      key={`sub-${v}`}
                      onClick={() => {
                        setPlayers((prev) =>
                          prev.map((p) =>
                            p.id === j.id
                              ? { ...p, saldo: Math.max(0, p.saldo - v) }
                              : p
                          )
                        );
                      }}
                      className="font-mono text-[10px] px-2 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      −{(v / 1000).toFixed(0)}k
                    </button>
                  ))}
                  <button className="font-mono text-[10px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 cursor-pointer ml-auto">
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
