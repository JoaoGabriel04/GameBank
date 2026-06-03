"use client";

import { useEffect, useState } from "react";
import {
  Server, RefreshCw, Lock, Users, Clock,
  Square, MessageSquare, ChevronRight, Search, Plus, Minus,
} from "lucide-react";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import { adminApi, type AdminSession, type SessionPlayer, type AdminChatMessage } from "@/services/api/admin";
import {
  Panel, Chip, Segmented, Btn, LiveDot, AdminInput, Drawer,
} from "@/components/admin/AdminUI";
import type { ChipTone } from "@/components/admin/AdminUI";

const STATUS_META: Record<string, { tone: ChipTone; live: boolean }> = {
  "Em Andamento": { tone: "emerald", live: true  },
  "Esperando":    { tone: "amber",   live: false },
  "Finalizada":   { tone: "zinc",    live: false },
};

function fmt(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function PlayerRow({
  player,
  disabled,
  onAdjust,
}: {
  player: SessionPlayer;
  disabled: boolean;
  onAdjust: (playerId: number, delta: number) => void;
}) {
  const name = player.user?.nome ?? player.nome;
  const avatar = player.user?.avatarUrl;
  const isNegative = player.saldo < 0;
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800">
      <div
        className="w-9 h-9 rounded-full grid place-items-center font-jaro text-sm text-white shrink-0"
        style={{ background: player.cor || "linear-gradient(135deg,#52525b,#27272a)" }}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-inconsolata text-sm text-zinc-100 truncate">{name}</p>
        <p className="font-inconsolata text-[10px] text-zinc-600">
          {player.cartaPrisao ? "tem carta de prisão · " : ""}
          {player.desistiu ? "desistiu" : "ativo"}
        </p>
      </div>
      <p className={`font-jaro text-base tabular-nums ${isNegative ? "text-rose-300" : "text-cyan-300"}`}>
        R$ {player.saldo.toLocaleString("pt-BR")}
      </p>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdjust(player.id, -1000)}
          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
          title="-R$ 1.000"
        >
          <Minus size={12} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdjust(player.id, 1000)}
          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
          title="+R$ 1.000"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

function SessionDrawer({
  session,
  open,
  onClose,
  onEnd,
  onAdjust,
  onRefreshDetail,
}: {
  session: AdminSession | null;
  open: boolean;
  onClose: () => void;
  onEnd: (id: number) => Promise<void>;
  onAdjust: (playerId: number, delta: number) => Promise<void>;
  onRefreshDetail: () => Promise<void>;
}) {
  const [ending, setEnding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<AdminChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const detail = useAdminStore((s) => (session ? s.sessionDetails[session.id] : undefined));

  async function handleToggleChat() {
    if (!session) return;
    if (!showChat && chatMessages.length === 0) {
      setLoadingChat(true);
      try {
        const msgs = await adminApi.getSessionChat(session.id);
        setChatMessages(msgs);
      } catch { /* ignore */ }
      finally { setLoadingChat(false); }
    }
    setShowChat((v) => !v);
  }

  if (!session) return null;

  const isLive = session.status === "Em Andamento";
  const meta = STATUS_META[session.status] ?? STATUS_META["Finalizada"];
  const sessionId = session.id;

  async function handleEnd() {
    setEnding(true);
    try { await onEnd(sessionId); onClose(); }
    finally { setEnding(false); }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try { await onRefreshDetail(); }
    finally { setRefreshing(false); }
  }

  async function handleAdjust(playerId: number, delta: number) {
    try { await onAdjust(playerId, delta); }
    catch { /* toast already shown by parent */ }
  }

  return (
    <Drawer open={open} onClose={onClose} width={520} title={session.nome ?? `Sala #${session.id}`} icon={Server}>
      <div className="p-5 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={meta.tone} dot={meta.live}>{session.status}</Chip>
          <Chip tone="zinc">#{session.id}</Chip>
          <Chip tone="zinc" className="capitalize">{session.modo}</Chip>
          {session.protegida && <Chip tone="zinc"><Lock size={10} className="inline mr-1" />protegida</Chip>}
          <span className="font-inconsolata text-[11px] text-zinc-500 ml-auto">
            R$ {session.saldoInicial.toLocaleString("pt-BR")} inicial
          </span>
        </div>

        {isLive && (
          <div className="grid grid-cols-3 gap-2">
            <Btn
              variant="subtle" icon={MessageSquare} size="sm" className="justify-center"
              onClick={handleToggleChat} disabled={loadingChat}
            >
              {loadingChat ? "Carregando…" : showChat ? "Fechar chat" : "Ver chat"}
            </Btn>
            <Btn
              variant="subtle" icon={RefreshCw} size="sm" className="justify-center"
              onClick={handleRefresh} disabled={refreshing}
            >
              {refreshing ? "Atualizando…" : "Atualizar"}
            </Btn>
            <Btn
              variant="danger" icon={Square} size="sm"
              className="justify-center" onClick={handleEnd} disabled={ending}
            >
              {ending ? "Encerrando…" : "Encerrar"}
            </Btn>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Jogadores", value: `${session.jogadoresCount}/${session.maxJogadores}` },
            { label: "Início",    value: fmt(session.dataInicio) },
            { label: "Modo",      value: session.modo },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <p className="font-inconsolata text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
              <p className="font-inconsolata text-sm text-zinc-100 mt-1 truncate capitalize">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-inconsolata text-xs text-zinc-400 font-semibold uppercase tracking-wider">
              Jogadores & saldos
            </p>
            <span className="font-inconsolata text-[10px] text-zinc-600">
              <Clock size={10} className="inline mr-0.5" /> {detail ? "em tempo real" : "—"}
            </span>
          </div>
          {detail?.jogadores && detail.jogadores.length > 0 ? (
            <div className="space-y-1.5">
              {detail.jogadores.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  disabled={!isLive}
                  onAdjust={handleAdjust}
                />
              ))}
            </div>
          ) : (
            <p className="font-inconsolata text-xs text-zinc-600 bg-zinc-900/40 border border-zinc-800 rounded-xl p-3">
              Nenhum jogador carregado. Clique em <b>Atualizar</b> para puxar a lista da sala.
            </p>
          )}
        </div>

        {showChat && (
          <div>
            <p className="font-inconsolata text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2">
              Chat da sala
            </p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto flex flex-col-reverse">
              {chatMessages.length === 0 ? (
                <p className="font-inconsolata text-xs text-zinc-600 p-3 text-center">
                  Nenhuma mensagem.
                </p>
              ) : (
                <div className="p-3 space-y-2">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2">
                      <span
                        className="w-2 h-2 rounded-full mt-1 shrink-0"
                        style={{ background: msg.player.cor || "#52525b" }}
                      />
                      <div className="min-w-0">
                        <span className="font-inconsolata text-[10px] text-zinc-500">
                          {msg.player.nome} ·{" "}
                          {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <p className="font-inconsolata text-xs text-zinc-300 leading-snug">
                          {msg.texto}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function SessionRow({ s, onClick }: { s: AdminSession; onClick: () => void }) {
  const meta = STATUS_META[s.status] ?? STATUS_META["Finalizada"];
  return (
    <tr
      className="border-b border-zinc-800/70 hover:bg-zinc-800/30 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {meta.live ? <LiveDot /> : (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.tone === "amber" ? "#fbbf24" : "#3f3f46" }} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-inconsolata text-sm text-zinc-100 truncate whitespace-nowrap">
                {s.nome ?? `Sala #${s.id}`}
              </span>
              {s.protegida && <Lock size={11} className="text-zinc-600 shrink-0" />}
            </div>
            <span className="font-inconsolata text-[10px] text-zinc-600 whitespace-nowrap">
              #{s.id} · {fmt(s.dataInicio)}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <Chip tone={meta.tone} dot={meta.live}>{s.status}</Chip>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell font-inconsolata text-xs text-zinc-400 capitalize">
        {s.modo}
      </td>
      <td className="px-4 py-3 text-center font-inconsolata text-xs text-zinc-300">
        {s.jogadoresCount}/{s.maxJogadores}
      </td>
      <td className="px-4 py-3 text-right font-inconsolata text-xs text-zinc-500 hidden sm:table-cell whitespace-nowrap">
        {fmt(s.dataInicio)}
      </td>
      <td className="px-4 py-3 text-right">
        <ChevronRight size={16} className="text-zinc-600 ml-auto" />
      </td>
    </tr>
  );
}

export default function AdminSessoesPage() {
  const {
    sessions, loadingSessions, loadSessions, loadSessionDetail,
    endSession, adjustPlayerBalance,
  } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [filter, setFilter] = useState("Todas");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<AdminSession | null>(null);

  useEffect(() => { loadSessions().catch(() => err("Erro ao carregar sessões.")); }, [loadSessions, err]);

  useEffect(() => {
    if (open) {
      loadSessionDetail(open.id).catch(() => err("Erro ao carregar detalhes da sala."));
    }
  }, [open, loadSessionDetail, err]);

  async function handleEnd(id: number) {
    try {
      await endSession(id);
      ok("Sala encerrada.");
      await loadSessions();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      err(msg || "Erro ao encerrar sala.");
      throw e;
    }
  }

  async function handleAdjust(playerId: number, delta: number) {
    if (!open) return;
    try {
      await adjustPlayerBalance(open.id, playerId, delta);
      ok(delta > 0 ? `+R$ ${delta.toLocaleString("pt-BR")} creditado.` : `-R$ ${Math.abs(delta).toLocaleString("pt-BR")} debitado.`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      err(msg || "Erro ao ajustar saldo.");
      throw e;
    }
  }

  async function handleRefreshDetail() {
    if (!open) return;
    try {
      await loadSessionDetail(open.id);
    } catch {
      err("Erro ao atualizar detalhes da sala.");
    }
  }

  const counts = {
    Todas:          sessions.length,
    "Ao vivo":      sessions.filter((s) => s.status === "Em Andamento").length,
    Esperando:      sessions.filter((s) => s.status === "Esperando").length,
    Finalizadas:    sessions.filter((s) => s.status === "Finalizada").length,
  };

  const list = sessions.filter((s) => {
    const matchFilter =
      filter === "Todas" ||
      (filter === "Ao vivo"    && s.status === "Em Andamento") ||
      (filter === "Esperando"  && s.status === "Esperando") ||
      (filter === "Finalizadas"&& s.status === "Finalizada");
    const term = q.toLowerCase();
    const matchQ = !q || (s.nome ?? "").toLowerCase().includes(term) || String(s.id).includes(q);
    return matchFilter && matchQ;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Segmented
          value={filter} onChange={setFilter}
          options={[
            { value: "Todas",       label: `Todas ${counts.Todas}` },
            { value: "Ao vivo",     label: `Ao vivo ${counts["Ao vivo"]}` },
            { value: "Esperando",   label: `Esperando ${counts.Esperando}` },
            { value: "Finalizadas", label: `Finalizadas ${counts.Finalizadas}` },
          ]}
        />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <AdminInput
              placeholder="Buscar por nome ou #id"
              value={q} onChange={(e) => setQ(e.target.value)}
              className="!pl-9 w-48"
            />
          </div>
          <Btn variant="ghost" icon={RefreshCw} size="sm" onClick={() => loadSessions()}>
            Atualizar
          </Btn>
        </div>
      </div>

      <Panel flush>
        {loadingSessions ? (
          <p className="py-20 text-center font-inconsolata text-sm text-zinc-500">Carregando sessões…</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                {["Sessão", "Status", "Modo", "Jog.", "Início", ""].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-2.5 font-inconsolata text-[10px] uppercase tracking-wider text-zinc-500
                      ${i === 3 ? "text-center" : ""}
                      ${i === 1 ? "hidden md:table-cell" : ""}
                      ${i === 2 ? "hidden lg:table-cell" : ""}
                      ${i === 4 ? "text-right hidden sm:table-cell" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <SessionRow key={s.id} s={s} onClick={() => setOpen(s)} />
              ))}
            </tbody>
          </table>
        )}
        {!loadingSessions && list.length === 0 && (
          <p className="py-12 text-center font-inconsolata text-sm text-zinc-600">
            Nenhuma sessão encontrada.
          </p>
        )}
      </Panel>

      <SessionDrawer
        session={open} open={!!open}
        onClose={() => setOpen(null)}
        onEnd={handleEnd}
        onAdjust={handleAdjust}
        onRefreshDetail={handleRefreshDetail}
      />
    </div>
  );
}
