"use client";

import { useState } from "react";
import { LiveSession } from "@/lib/admin/types";
import { X, Save, Trash2, Edit2, Check } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

interface SessionControlModalProps {
  session: LiveSession;
  isOpen: boolean;
  onClose: () => void;
  onSessionUpdated?: () => void;
}

export default function SessionControlModal({
  session,
  isOpen,
  onClose,
  onSessionUpdated,
}: SessionControlModalProps) {
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [editingSaldo, setEditingSaldo] = useState<string>("");
  const [isPaused, setIsPaused] = useState(false);

  if (!isOpen) return null;

  const handleEditSaldo = (playerId: number, currentSaldo: number) => {
    setEditingPlayerId(playerId);
    setEditingSaldo(String(currentSaldo));
  };

  const handleSaveSaldo = async (playerId: number) => {
    try {
      const newSaldo = parseInt(editingSaldo);
      if (isNaN(newSaldo) || newSaldo < 0) {
        alert("Saldo deve ser um número positivo");
        return;
      }

      // TODO: API call to update player saldo
      console.log(`Atualizando saldo do jogador ${playerId} para ${newSaldo}`);

      setEditingPlayerId(null);
      setEditingSaldo("");
    } catch (error) {
      console.error("Erro ao salvar saldo:", error);
    }
  };

  const handleKickPlayer = async (playerId: number, playerName: string) => {
    if (!confirm(`Deseja remover ${playerName} da sessão?`)) return;

    try {
      // TODO: API call to kick player
      console.log(`Removendo jogador ${playerId} da sessão`);
      onSessionUpdated?.();
    } catch (error) {
      console.error("Erro ao remover jogador:", error);
    }
  };

  const handleFinishSession = async () => {
    if (!confirm(`Deseja finalizar a sessão "${session.nome}"?`)) return;

    try {
      // TODO: API call to finish session
      console.log(`Finalizando sessão ${session.id}`);
      onSessionUpdated?.();
      onClose();
    } catch (error) {
      console.error("Erro ao finalizar sessão:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-jaro font-bold text-zinc-100">{session.nome}</h2>
            <p className="text-xs text-zinc-500 mt-1">
              {session.modo === "individual" ? "Individual" : "Duplas"} · {session.status}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Saldo Total */}
            <div className="admin-card p-4">
              <p className="text-xs font-mono uppercase text-zinc-500 mb-1">Saldo Total</p>
              <p className="text-2xl font-jaro font-bold text-green-400">
                R$ {session.saldoTotal.toLocaleString("pt-BR")}
              </p>
            </div>

            {/* Jogadores */}
            <div>
              <h3 className="text-sm font-jaro font-bold text-zinc-200 mb-3">Jogadores ({session.jogadores.length})</h3>
              <div className="space-y-2">
                {session.jogadores.map((jogador) => (
                  <div
                    key={jogador.id}
                    className="admin-card p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full border-2 flex-shrink-0"
                        style={{ borderColor: jogador.cor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm text-zinc-100 truncate">{jogador.nome}</p>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {session.ownerId === jogador.id && "👑 Host"}
                        </p>
                      </div>
                    </div>

                    {editingPlayerId === jogador.id ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="number"
                          value={editingSaldo}
                          onChange={(e) => setEditingSaldo(e.target.value)}
                          className="admin-input w-20 text-right py-1 px-2"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveSaldo(jogador.id)}
                          className="p-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="font-mono text-sm text-zinc-300 w-24 text-right">
                          R$ {jogador.saldo.toLocaleString("pt-BR")}
                        </p>
                        <button
                          onClick={() => handleEditSaldo(jogador.id, jogador.saldo)}
                          className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                          title="Editar saldo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {session.ownerId !== jogador.id && (
                          <button
                            onClick={() => handleKickPlayer(jogador.id, jogador.nome)}
                            className="p-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            title="Remover da sala"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-6 py-4 flex items-center gap-3 bg-zinc-950">
          <button
            onClick={onClose}
            className="flex-1 admin-button-secondary"
          >
            Fechar
          </button>
          <button
            onClick={handleFinishSession}
            className="flex-1 admin-button-danger"
          >
            Finalizar Sessão
          </button>
        </div>
      </div>
    </div>
  );
}
