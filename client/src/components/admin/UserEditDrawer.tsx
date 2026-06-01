"use client";

import React, { useState } from "react";
import { Drawer, Avatar } from "./AdminBase";
import { AdminUser } from "@/lib/admin/types";
import { Shield, Ban } from "lucide-react";

interface UserEditDrawerProps {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
}

export default function UserEditDrawer({
  user,
  open,
  onClose,
}: UserEditDrawerProps) {
  const [coins, setCoins] = useState(user?.coins || 0);
  const [level, setLevel] = useState(user?.level || 1);
  const [xp, setXp] = useState(user?.xp || 0);
  const [isAdmin, setIsAdmin] = useState(user?.isAdmin || false);
  const [banned, setBanned] = useState(user?.isBanned || false);

  React.useEffect(() => {
    if (user) {
      setCoins(user.coins);
      setLevel(user.level);
      setXp(user.xp);
      setIsAdmin(user.isAdmin);
      setBanned(user.isBanned);
    }
  }, [user]);

  if (!user) return null;

  const winRate =
    user.totalGames > 0
      ? ((user.totalWins / user.totalGames) * 100).toFixed(0)
      : "0";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={460}
      title="Editar usuário"
      icon={undefined}
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Avatar user={user} size={52} />
          <div className="min-w-0">
            <h3 className="font-jaro text-lg text-white truncate">
              {user.nome}
            </h3>
            <p className="font-mono text-xs text-zinc-500 truncate">
              {user.email}
            </p>
            <p className="font-mono text-[10px] text-zinc-600">
              #{user.id}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            ["Partidas", user.totalGames],
            ["Vitórias", user.totalWins],
            ["Win %", `${winRate}%`],
            ["Nível", level],
          ].map(([label, value]) => (
            <div
              key={label}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-center"
            >
              <p className="font-jaro text-base text-white leading-none">
                {value}
              </p>
              <p className="font-mono text-[9px] text-zinc-500 mt-1">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Economy Controls */}
        <div className="space-y-4">
          {/* Coins */}
          <div>
            <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
              Coins — R$ {coins.toLocaleString("pt-BR")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100000"
                step="100"
                value={coins}
                onChange={(e) => setCoins(parseInt(e.target.value))}
                className="flex-1 h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
              />
              <input
                type="number"
                value={coins}
                onChange={(e) => setCoins(parseInt(e.target.value) || 0)}
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Level & XP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
                Nível — {level}
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase text-zinc-500 mb-2">
                XP — {xp.toLocaleString("pt-BR")}
              </label>
              <input
                type="range"
                min="0"
                max="100000"
                step="100"
                value={xp}
                onChange={(e) => setXp(parseInt(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between font-mono text-[10px] text-zinc-500 mb-1">
              <span>Progresso do nível</span>
              <span>{Math.round((xp / 100000) * 100)}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all"
                style={{ width: `${(xp / 100000) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Role + Status Toggles */}
        <div className="space-y-2">
          <label className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 cursor-pointer hover:border-violet-500/50 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="text-violet-400">
                <Shield size={16} />
              </span>
              <div>
                <p className="font-mono text-sm text-zinc-200">Administrador</p>
                <p className="font-mono text-[10px] text-zinc-500">
                  Acesso total ao console
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 accent-cyan-500 cursor-pointer"
            />
          </label>

          <label
            className={`flex items-center justify-between border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
              banned
                ? "bg-red-500/5 border-red-500/30 hover:border-red-500/50"
                : "bg-zinc-900 border-zinc-800 hover:border-red-500/50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-red-400">
                <Ban size={16} />
              </span>
              <div>
                <p className="font-mono text-sm text-zinc-200">Banir usuário</p>
                <p className="font-mono text-[10px] text-zinc-500">
                  Bloqueia login e partidas
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={banned}
              onChange={(e) => setBanned(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 accent-red-500 cursor-pointer"
            />
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 transition-colors font-mono text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-600 transition-colors font-mono text-sm font-medium"
          >
            Salvar alterações
          </button>
        </div>
      </div>
    </Drawer>
  );
}
