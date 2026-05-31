"use client";

import { useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import { endSessionApi } from "@/services/api/sessions";
import { Lock, Users, Clock, RefreshCw } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  "Esperando":    "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "Em Andamento": "bg-green-500/10 text-green-400 border-green-500/30",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminSessoesPage() {
  const { sessions, loadingSessions, loadSessions } = useAdminStore();
  const { success: toastSuccess, warning: toastWarning } = useToast();

  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function handleEnd(sessionId: number, nome: string | null) {
    if (!confirm(`Encerrar a sala "${nome ?? `#${sessionId}`}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await endSessionApi(sessionId);
      toastSuccess("Sala encerrada.");
      loadSessions();
    } catch (err: any) {
      toastWarning(err?.response?.data?.message || "Erro ao encerrar sala.");
    }
  }

  const esperando   = sessions.filter((s) => s.status === "Esperando");
  const emAndamento = sessions.filter((s) => s.status === "Em Andamento");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-jaro text-2xl text-white flex items-center gap-2">
          🎮 Sessões Ativas
          <span className="text-sm font-inconsolata text-zinc-500 font-normal">({sessions.length})</span>
        </h1>
        <button
          onClick={() => loadSessions()}
          className="flex items-center gap-2 px-3 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded-xl text-sm font-inconsolata transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {loadingSessions ? (
        <p className="text-zinc-500 font-inconsolata text-center py-20">Carregando sessões...</p>
      ) : sessions.length === 0 ? (
        <p className="text-zinc-500 font-inconsolata text-center py-20">Nenhuma sessão ativa no momento.</p>
      ) : (
        <div className="space-y-6">
          {[
            { label: "Em Andamento", list: emAndamento },
            { label: "Aguardando",   list: esperando },
          ].map(({ label, list }) =>
            list.length > 0 ? (
              <div key={label}>
                <h2 className="text-sm font-inconsolata text-zinc-500 uppercase tracking-wide mb-3">{label} ({list.length})</h2>
                <div className="space-y-3">
                  {list.map((s) => (
                    <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-jaro text-base text-white truncate">{s.nome || `Sala #${s.id}`}</span>
                          {s.protegida && <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                          <span className={`text-[10px] font-inconsolata px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[s.status] ?? ""}`}>{s.status}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-inconsolata text-zinc-500">
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{s.jogadoresCount}/{s.maxJogadores}</span>
                          <span className="capitalize">{s.modo}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDate(s.dataInicio)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleEnd(s.id, s.nome)}
                        className="shrink-0 px-3 py-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-inconsolata transition-colors cursor-pointer"
                      >
                        Encerrar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
