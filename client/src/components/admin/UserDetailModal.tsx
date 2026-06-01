"use client";

import { useState } from "react";
import { AdminUser } from "@/lib/admin/types";
import { X, Save } from "lucide-react";

interface UserDetailModalProps {
  user: AdminUser;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: () => void;
}

export default function UserDetailModal({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}: UserDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    coins: user.coins,
    xp: user.xp,
    level: user.level,
  });

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData((prev) => ({
      ...prev,
      [field]: numValue,
    }));
  };

  const handleSave = async () => {
    try {
      // TODO: API call to update user
      console.log(`Atualizando usuário ${user.id}:`, formData);
      setIsEditing(false);
      onUserUpdated?.();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
    }
  };

  const winRate = user.totalGames > 0 ? ((user.totalWins / user.totalGames) * 100).toFixed(1) : "0";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-jaro font-bold text-zinc-100">{user.nome}</h2>
            <p className="text-xs text-zinc-500 mt-1">{user.email}</p>
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
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="admin-card p-4">
                <p className="text-xs font-mono uppercase text-zinc-500 mb-1">Nível</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.level}
                    onChange={(e) => handleInputChange("level", e.target.value)}
                    className="admin-input w-full text-2xl font-jaro font-bold py-1"
                    min="1"
                    max="100"
                  />
                ) : (
                  <p className="text-2xl font-jaro font-bold text-cyan-400">{user.level}</p>
                )}
              </div>

              <div className="admin-card p-4">
                <p className="text-xs font-mono uppercase text-zinc-500 mb-1">Taxa Vitória</p>
                <p className="text-2xl font-jaro font-bold text-green-400">{winRate}%</p>
              </div>

              <div className="admin-card p-4">
                <p className="text-xs font-mono uppercase text-zinc-500 mb-1">Partidas</p>
                <p className="text-2xl font-jaro font-bold text-blue-400">{user.totalGames}</p>
              </div>

              <div className="admin-card p-4">
                <p className="text-xs font-mono uppercase text-zinc-500 mb-1">Vitórias</p>
                <p className="text-2xl font-jaro font-bold text-yellow-400">{user.totalWins}</p>
              </div>
            </div>

            {/* Resources */}
            <div className="space-y-3">
              <div className="admin-card p-4">
                <label className="block text-xs font-mono uppercase text-zinc-500 mb-2">
                  Moedas
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.coins}
                    onChange={(e) => handleInputChange("coins", e.target.value)}
                    className="admin-input w-full text-lg font-jaro font-bold py-2"
                    min="0"
                  />
                ) : (
                  <p className="text-lg font-jaro font-bold text-amber-400">
                    R$ {user.coins.toLocaleString("pt-BR")}
                  </p>
                )}
              </div>

              <div className="admin-card p-4">
                <label className="block text-xs font-mono uppercase text-zinc-500 mb-2">
                  Experiência
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.xp}
                    onChange={(e) => handleInputChange("xp", e.target.value)}
                    className="admin-input w-full text-lg font-jaro font-bold py-2"
                    min="0"
                  />
                ) : (
                  <p className="text-lg font-jaro font-bold text-purple-400">
                    {user.xp.toLocaleString("pt-BR")} XP
                  </p>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <div className="admin-card p-3 flex items-center justify-between">
                <span className="text-sm font-mono text-zinc-400">Administrador</span>
                <span className={`px-2 py-1 rounded text-xs font-mono ${
                  user.isAdmin ? "bg-cyan-500/20 text-cyan-400" : "bg-zinc-700/50 text-zinc-400"
                }`}>
                  {user.isAdmin ? "Sim" : "Não"}
                </span>
              </div>

              <div className="admin-card p-3 flex items-center justify-between">
                <span className="text-sm font-mono text-zinc-400">Banido</span>
                <span className={`px-2 py-1 rounded text-xs font-mono ${
                  user.isBanned ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                }`}>
                  {user.isBanned ? "Sim" : "Não"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-6 py-4 flex items-center gap-3 bg-zinc-950">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    coins: user.coins,
                    xp: user.xp,
                    level: user.level,
                  });
                }}
                className="flex-1 admin-button-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 admin-button-primary flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 admin-button-secondary"
              >
                Fechar
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 admin-button-primary"
              >
                Editar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
