"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHead, LiveDot } from "@/components/admin/AdminBase";
import SessionControlDrawer from "@/components/admin/SessionControlDrawer";
import { LiveSession } from "@/lib/admin/types";
import { Server, Edit2, X } from "lucide-react";

export default function AdminSessionsPage() {
  const [sessions, setSession] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);

  async function load() {
    setLoading(true);
    try {
      // Mock data
      const mockSessions: LiveSession[] = [
        {
          id: 1,
          nome: "Sala Alta Stakes",
          modo: "individual",
          status: "Em Andamento",
          jogadores: [
            { id: 101, nome: "João Silva", saldo: 2500, cor: "cyan" },
            { id: 102, nome: "Maria Santos", saldo: 3100, cor: "teal" },
            { id: 103, nome: "Pedro Costa", saldo: 1800, cor: "emerald" },
          ],
          saldoTotal: 7400,
          duracao: 1847,
          ownerId: 101,
          dataInicio: Date.now() - 1847000,
        },
        {
          id: 2,
          nome: "Sala Casual",
          modo: "duplas",
          status: "Em Andamento",
          jogadores: [
            { id: 201, nome: "Ana Oliveira", saldo: 1200, cor: "amber" },
            { id: 202, nome: "Carlos Mendes", saldo: 1500, cor: "green" },
          ],
          saldoTotal: 2700,
          duracao: 923,
          ownerId: 201,
          dataInicio: Date.now() - 923000,
        },
      ];
      setSession(mockSessions);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
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
          title="Sessões em execução"
          icon={Server}
          sub={`${sessions.length} partida(s) ao vivo agora`}
        />
        <div className="divide-y divide-zinc-800">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="pt-1">
                  <LiveDot />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-mono text-sm font-semibold text-zinc-100 truncate">
                      {s.nome}
                    </h3>
                    <span className="font-mono text-xs text-zinc-600">#{s.id}</span>
                  </div>
                  <p className="font-mono text-xs text-zinc-500">
                    {s.modo === "individual" ? "Individual" : "Duplas"} •{" "}
                    {s.jogadores.length} jogadores • {formatDuration(s.duracao)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {s.jogadores.slice(0, 4).map((j) => (
                      <span
                        key={j.id}
                        className="text-xs font-mono text-zinc-400"
                        title={j.nome}
                      >
                        {j.nome.split(" ")[0]}
                      </span>
                    ))}
                    {s.jogadores.length > 4 && (
                      <span className="text-xs font-mono text-zinc-600">
                        +{s.jogadores.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right mr-4">
                <p className="font-mono text-sm font-semibold text-emerald-400">
                  R$ {s.saldoTotal.toLocaleString("pt-BR")}
                </p>
                <p className="font-mono text-xs text-zinc-500">
                  {s.jogadores.length} jogadores
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedSession(s)}
                  className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <SessionControlDrawer
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "agora";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
