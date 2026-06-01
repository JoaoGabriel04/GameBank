"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHead } from "@/components/admin/AdminBase";
import { AuditLog } from "@/lib/admin/types";
import { Scroll, Search, Filter } from "lucide-react";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("");

  async function load() {
    setLoading(true);
    try {
      const mockLogs: AuditLog[] = [
        {
          id: 1,
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          actorId: 1,
          action: "user_ban",
          targetType: "user",
          targetId: 42,
          details: { reason: "Comportamento ofensivo" },
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
          actorId: 1,
          action: "item_created",
          targetType: "shop_item",
          targetId: 15,
          details: { name: "Badge Lenda", price: 5000 },
        },
        {
          id: 3,
          timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
          actorId: 2,
          action: "config_updated",
          targetType: "economy",
          details: { coinMultiplier: 1.5 },
        },
        {
          id: 4,
          timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
          actorId: 3,
          action: "session_ended",
          targetType: "session",
          targetId: 156,
          details: { duration: 3600, winner: "João Silva" },
        },
      ];
      setLogs(mockLogs);
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

  const ACTION_LABELS: Record<string, string> = {
    user_ban: "Usuário Banido",
    user_unban: "Usuário Desbanido",
    item_created: "Item Criado",
    item_deleted: "Item Deletado",
    config_updated: "Config Atualizada",
    session_ended: "Sessão Finalizada",
  };

  const ACTION_ICONS: Record<string, string> = {
    user_ban: "🚫",
    user_unban: "✅",
    item_created: "➕",
    item_deleted: "🗑️",
    config_updated: "⚙️",
    session_ended: "🏁",
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetId?.toString().includes(searchTerm) ||
      log.actorId.toString().includes(searchTerm);

    const matchesFilter = !filterAction || log.action === filterAction;

    return matchesSearch && matchesFilter;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-jaro text-xl text-white">
          {logs.length} log(s) de ação
        </h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-zinc-600" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Pesquisar por ação, ID, usuário..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors placeholder:text-zinc-600"
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterAction("")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
            filterAction === ""
              ? "bg-cyan-500 text-zinc-950"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <Filter size={14} />
          Todas as Ações
        </button>

        {uniqueActions.map((action) => (
          <button
            key={action}
            onClick={() => setFilterAction(filterAction === action ? "" : action)}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
              filterAction === action
                ? "bg-cyan-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {ACTION_ICONS[action] || "•"} {ACTION_LABELS[action] || action}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <Panel flush>
        <PanelHead title="Log de auditoria" icon={Scroll} />
        <div className="divide-y divide-zinc-800">
          {filteredLogs.length === 0 ? (
            <p className="px-4 py-8 text-xs text-zinc-500 text-center">
              Nenhum log encontrado
            </p>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-lg">
                    {ACTION_ICONS[log.action] || "•"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-zinc-200">
                      {ACTION_LABELS[log.action] || log.action}
                    </p>
                    <p className="font-mono text-xs text-zinc-600">
                      {log.targetType}
                      {log.targetId && `#${log.targetId}`}
                    </p>
                  </div>
                </div>

                <div className="text-right ml-4">
                  <p className="font-mono text-xs text-zinc-400">
                    Admin #{log.actorId}
                  </p>
                  <p className="font-mono text-xs text-zinc-600">
                    {new Date(log.timestamp).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
