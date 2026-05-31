"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import UserAvatar from "@/components/UserAvatar";
import { Check, X } from "lucide-react";
import type { AdminUser } from "@/services/api/admin";

function CoinAdjust({ user, onAdjust }: { user: AdminUser; onAdjust: (delta: number) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handle() {
    if (!delta) return;
    setSaving(true);
    try {
      await onAdjust(delta);
      setOpen(false);
      setDelta(0);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-inconsolata text-zinc-400 hover:text-yellow-400 transition-colors cursor-pointer underline underline-offset-2">
        Ajustar coins
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={delta}
        onChange={(e) => setDelta(Number(e.target.value))}
        className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs font-inconsolata text-zinc-100 focus:outline-none"
        placeholder="±"
        autoFocus
      />
      <button onClick={handle} disabled={saving || !delta} className="text-green-400 hover:text-green-300 disabled:opacity-40 cursor-pointer">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => { setOpen(false); setDelta(0); }} className="text-zinc-400 hover:text-white cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function AdminUsuariosPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { users, loadingUsers, loadUsers, adjustCoins } = useAdminStore();
  const { success: toastSuccess, error: toastError } = useToast();

  useEffect(() => {
    if (user !== null && !user.isAdmin) router.replace("/");
  }, [user, router]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleAdjust(userId: number, delta: number) {
    try {
      await adjustCoins(userId, delta);
      toastSuccess(`Coins ajustados com sucesso.`);
    } catch {
      toastError("Erro ao ajustar coins.");
      throw new Error("adjust failed");
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-jaro text-2xl text-white flex items-center gap-2">
          👥 Usuários
          <span className="text-sm font-inconsolata text-zinc-500 font-normal">({users.length})</span>
        </h1>
      </div>

      {loadingUsers ? (
        <p className="text-zinc-500 font-inconsolata text-center py-20">Carregando usuários...</p>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-inconsolata text-zinc-500 uppercase tracking-wide">Usuário</th>
                  <th className="text-left px-4 py-3 text-xs font-inconsolata text-zinc-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                  <th className="text-center px-4 py-3 text-xs font-inconsolata text-zinc-500 uppercase tracking-wide">Nível</th>
                  <th className="text-right px-4 py-3 text-xs font-inconsolata text-zinc-500 uppercase tracking-wide">Coins</th>
                  <th className="text-center px-4 py-3 text-xs font-inconsolata text-zinc-500 uppercase tracking-wide hidden md:table-cell">Partidas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar avatarUrl={u.avatarUrl} avatarUpdatedAt={u.avatarUpdatedAt} nome={u.nome} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-inconsolata text-zinc-100">{u.nome}</span>
                            {u.isAdmin && (
                              <span className="text-[9px] font-inconsolata bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-inconsolata text-zinc-500">#{u.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs font-inconsolata text-zinc-400">{u.email}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-inconsolata text-zinc-200">{u.level}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-inconsolata text-yellow-400 font-bold">{u.coins.toLocaleString("pt-BR")}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="text-xs font-inconsolata text-zinc-400">{u.totalGames}</span>
                    </td>
                    <td className="px-4 py-3">
                      <CoinAdjust user={u} onAdjust={(delta) => handleAdjust(u.id, delta)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
