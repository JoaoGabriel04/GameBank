"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHead, Avatar } from "@/components/admin/AdminBase";
import UserEditDrawer from "@/components/admin/UserEditDrawer";
import { AdminUser } from "@/lib/admin/types";
import { Users, Edit2, Ban } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  async function load() {
    setLoading(true);
    try {
      const mockUsers: AdminUser[] = [
        {
          id: 1,
          nome: "João Silva",
          email: "joao@example.com",
          level: 15,
          xp: 45000,
          coins: 12500,
          isAdmin: false,
          isBanned: false,
          totalGames: 128,
          totalWins: 42,
        },
        {
          id: 2,
          nome: "Maria Santos",
          email: "maria@example.com",
          level: 18,
          xp: 67000,
          coins: 28900,
          isAdmin: false,
          isBanned: false,
          totalGames: 156,
          totalWins: 67,
        },
        {
          id: 3,
          nome: "Pedro Costa",
          email: "pedro@example.com",
          level: 12,
          xp: 32000,
          coins: 8750,
          isAdmin: true,
          isBanned: false,
          totalGames: 89,
          totalWins: 31,
        },
        {
          id: 4,
          nome: "Ana Oliveira",
          email: "ana@example.com",
          level: 9,
          xp: 18000,
          coins: 4200,
          isAdmin: false,
          isBanned: true,
          totalGames: 34,
          totalWins: 8,
        },
      ];
      setUsers(mockUsers);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Panel flush>
        <PanelHead
          title="Usuários registrados"
          icon={Users}
          sub={`${users.length} usuário(s) no sistema`}
        />
        <div className="divide-y divide-zinc-800">
          {users.map((u) => {
            const winRate =
              u.totalGames > 0
                ? ((u.totalWins / u.totalGames) * 100).toFixed(1)
                : "0";

            return (
              <div
                key={u.id}
                className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Avatar user={{ nome: u.nome }} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono text-sm font-semibold text-zinc-100">
                        {u.nome}
                      </h3>
                      {u.isAdmin && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
                          Admin
                        </span>
                      )}
                      {u.isBanned && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300">
                          Banido
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-zinc-500">{u.email}</p>
                  </div>
                </div>

                <div className="hidden sm:grid grid-cols-4 gap-6 text-right mr-4">
                  <div>
                    <p className="font-mono text-xs text-zinc-500">Nível</p>
                    <p className="font-jaro text-lg text-cyan-400">{u.level}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-zinc-500">Partidas</p>
                    <p className="font-jaro text-lg text-blue-400">
                      {u.totalGames}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-zinc-500">Taxa</p>
                    <p className="font-jaro text-lg text-green-400">{winRate}%</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-zinc-500">Moedas</p>
                    <p className="font-jaro text-lg text-amber-400">
                      {(u.coins / 1000).toFixed(1)}k
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  {!u.isBanned && (
                    <button className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                      <Ban size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <UserEditDrawer
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}
