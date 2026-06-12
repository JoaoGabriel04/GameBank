/* eslint-disable */
"use client";

import { useEffect, useState } from "react";
import {
  Search, Download, Activity, Check,
  Bell, Ban,
} from "lucide-react";
import {
  Panel, Chip, Segmented, Btn, AdminInput,
} from "@/components/admin/AdminUI";
import type { ChipTone } from "@/components/admin/AdminUI";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import type { AuditEntry } from "@/services/api/admin";

type Severity = "info" | "success" | "warn" | "danger";
type ActorRole = "admin" | "system" | "user";

const SEV_META: Record<Severity, { tone: ChipTone; label: string; icon: React.ComponentType<{ size?: number }> }> = {
  info:    { tone: "sky",     label: "Info",    icon: Activity  },
  success: { tone: "emerald", label: "Sucesso", icon: Check     },
  warn:    { tone: "amber",   label: "Aviso",   icon: Bell      },
  danger:  { tone: "rose",    label: "Crítico", icon: Ban       },
};

const SEV_TONE_BG: Record<ChipTone, string> = {
  cyan:    "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  sky:     "bg-sky-500/10 text-sky-300 border-sky-500/20",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  amber:   "bg-amber-500/10 text-amber-300 border-amber-500/20",
  rose:    "bg-rose-500/10 text-rose-300 border-rose-500/20",
  violet:  "bg-violet-500/10 text-violet-300 border-violet-500/20",
  zinc:    "bg-zinc-700/30 text-zinc-400 border-zinc-600/40",
  teal:    "bg-teal-500/10 text-teal-300 border-teal-500/20",
};

const ROLE_TONE: Record<ActorRole, ChipTone> = {
  admin: "violet", system: "zinc", user: "cyan",
};

function inferRole(entry: AuditEntry): ActorRole {
  if (!entry.actorId) return "system";
  if (entry.action.startsWith("user.") || entry.action.startsWith("session.") || entry.action.startsWith("mission.")) return "admin";
  return "user";
}

function fmtTs(ts: string) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function exportCsv(rows: AuditEntry[]) {
  const header = "id,ts,actorId,actorNome,action,target,severity\n";
  const body = rows.map((r) => [
    r.id,
    r.ts,
    r.actorId ?? "",
    (r.actorNome ?? "").replace(/,/g, " "),
    r.action,
    (r.target ?? "").replace(/,/g, " "),
    r.severity,
  ].join(",")).join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminAuditPage() {
  const { audit, loadingAudit, loadAudit } = useAdminStore();
  const { error: err } = useToast();
  const [sev, setSev] = useState("Todos");
  const [q, setQ] = useState("");

  useEffect(() => {
    loadAudit({ limit: 200 }).catch(() => err("Erro ao carregar auditoria."));
  }, [loadAudit, err]);

  const counts = {
    info:    audit.filter((l) => l.severity === "info").length,
    success: audit.filter((l) => l.severity === "success").length,
    warn:    audit.filter((l) => l.severity === "warn").length,
    danger:  audit.filter((l) => l.severity === "danger").length,
  };

  const list = audit.filter((l) => {
    const matchSev =
      sev === "Todos" ||
      (sev === "Info"    && l.severity === "info") ||
      (sev === "Sucesso" && l.severity === "success") ||
      (sev === "Aviso"   && l.severity === "warn") ||
      (sev === "Crítico" && l.severity === "danger");
    const term = q.toLowerCase();
    const matchQ = !q ||
      (l.actorNome ?? "").toLowerCase().includes(term) ||
      l.action.toLowerCase().includes(term) ||
      (l.target ?? "").toLowerCase().includes(term);
    return matchSev && matchQ;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.entries(SEV_META) as [Severity, typeof SEV_META[Severity]][]).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <div key={key} className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl grid place-items-center border ${SEV_TONE_BG[meta.tone]}`}>
                <Icon size={16} />
              </span>
              <div>
                <p className="font-jaro text-xl text-white leading-none">{counts[key]}</p>
                <p className="font-inconsolata text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{meta.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Segmented
          value={sev} onChange={setSev}
          options={[
            { value: "Todos",   label: `Todos ${audit.length}` },
            { value: "Info",    label: `Info ${counts.info}` },
            { value: "Sucesso", label: `Sucesso ${counts.success}` },
            { value: "Aviso",   label: `Avisos ${counts.warn}` },
            { value: "Crítico", label: `Críticos ${counts.danger}` },
          ]}
        />
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <AdminInput
              placeholder="Buscar no log"
              value={q} onChange={(e) => setQ(e.target.value)}
              className="!pl-9"
            />
          </div>
          <Btn variant="ghost" icon={Download} size="sm" className="hidden sm:inline-flex" onClick={() => exportCsv(list)}>
            Exportar
          </Btn>
        </div>
      </div>

      <Panel flush>
        {loadingAudit ? (
          <p className="py-20 text-center font-inconsolata text-sm text-zinc-500">Carregando auditoria…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  {["Severidade", "Quando", "Autor", "Ação", "Alvo"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 font-inconsolata text-[10px] uppercase tracking-wider text-zinc-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((l) => {
                  const meta = SEV_META[l.severity];
                  const role = inferRole(l);
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-zinc-800/70 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Chip tone={meta.tone} dot>{meta.label}</Chip>
                      </td>
                      <td className="px-4 py-3 font-inconsolata text-[11px] text-zinc-500 whitespace-nowrap">
                        {fmtTs(l.ts)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-inconsolata text-xs text-zinc-200 whitespace-nowrap">
                            {l.actorNome ?? "—"}
                          </span>
                          <Chip tone={ROLE_TONE[role]}>{role}</Chip>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-inconsolata text-xs text-zinc-300 whitespace-nowrap">
                        {l.action}
                      </td>
                      <td className="px-4 py-3 font-inconsolata text-xs text-zinc-400">
                        {l.target ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loadingAudit && list.length === 0 && (
          <p className="py-12 text-center font-inconsolata text-sm text-zinc-600">
            {audit.length === 0 ? "Nenhuma ação registrada ainda." : "Nenhum registro encontrado."}
          </p>
        )}
      </Panel>
    </div>
  );
}
