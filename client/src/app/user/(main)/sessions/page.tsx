'use client';

/**
 * Salas — redesign
 * Salve em: src/app/user/(main)/sessions/page.tsx
 *
 * Mantém toda a lógica de join/spectator/duplas existente.
 * Adiciona: layout de cards com avatares dos jogadores, filtro segmentado,
 * busca por nome, modal de criação redesenhado.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Lock, Users, ChevronRight, Eye, LogIn,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useSessions } from "@/hooks/useApi";
import { sessionsApi } from "@/services/api/sessions";
import { setRoomToken } from "@/stores/roomTokenStore";
import UserAvatar from "@/components/UserAvatar";
import UserBadge from "@/components/UserBadge";
import { Segmented, LiveDot, UModal, UBtn } from "@/components/user/UserUI";
import type { GameSession } from "@/types/game";
import { apiErrMsg } from "@/lib/api-error";

/* ── Join modal (mantém lógica existente, visual redesenhado) ── */
function JoinModal({
  session,
  open,
  onClose,
}: {
  session: GameSession | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { mutate } = useSessions();
  const [password, setPassword]       = useState("");
  const [teamId, setTeamId]           = useState<number | undefined>(undefined);
  const [spectator, setSpectator]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  useEffect(() => {
    if (open) { setPassword(""); setTeamId(undefined); setSpectator(false); setError(""); }
  }, [open, session]);

  if (!session) return null;
  const isLive = session.status === "Em Andamento";

  async function handleJoin() {
    if (!user || !session) return;
    setLoading(true);
    setError("");
    try {
      const res = await sessionsApi.join(session.id, {
        senha: password || undefined,
        nome: user.nome,
        teamId,
        spectator: spectator || undefined,
      });
      const token = res.data?.roomToken;
      if (token) setRoomToken(token);
      onClose();
      mutate();
      router.push(`/user/game/${session.id}`);
    } catch (err) {
      setError(apiErrMsg(err, "Erro ao entrar na sala."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <UModal open={open} onClose={onClose} width={440}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-jaro text-lg text-white whitespace-nowrap">
          {isLive ? "Espiar partida" : `Entrar em "${session.nome || `#${session.id}`}"`}
        </h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer p-1">
          <ChevronRight size={16} className="rotate-180" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <p className="text-rose-400 text-sm font-inconsolata bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {user && (
          <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
            <UserAvatar avatarUrl={user.avatarUrl} avatarUpdatedAt={user.avatarUpdatedAt} nome={user.nome} size="md" />
            <div>
              <div className="font-inconsolata text-sm text-zinc-100 flex items-center gap-1.5">
                <UserBadge badge={user.badge} imageUrl={user.badgeImageUrl} variant="micro" />
                {user.nome}
              </div>
              <p className="font-inconsolata text-xs text-zinc-500">Entrar com este perfil</p>
            </div>
          </div>
        )}

        {session.protegida && !isLive && (
          <div>
            <label className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 block mb-1.5">
              Senha da sala
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-2.5 font-inconsolata text-sm text-zinc-100 focus:border-green-500 focus:outline-none placeholder:text-zinc-600"
            />
          </div>
        )}

        {(() => {
          type SessionWithTimes = { times?: { id: number; nome: string }[] };
          type PlayerWithTeam = { teamId?: number };
          const ext = session as unknown as SessionWithTimes;
          if (session.modo !== "duplas" || !ext.times?.length || isLive) return null;
          return (
          <div>
            <label className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 block mb-1.5">
              Escolha o time
            </label>
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-2.5 font-inconsolata text-sm text-zinc-100 focus:border-green-500 focus:outline-none cursor-pointer"
            >
              <option value="">Selecione um time</option>
              {(ext.times ?? []).map((t) => {
                const count = session.jogadores.filter((j) => (j as unknown as PlayerWithTeam).teamId === t.id).length;
                return (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({count} jogador{count !== 1 ? "es" : ""})
                  </option>
                );
              })}
            </select>
          </div>
          );
        })()}

        {!isLive && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={spectator}
              onChange={(e) => setSpectator(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-green-500 focus:ring-green-500 cursor-pointer accent-green-500"
            />
            <span className="font-inconsolata text-sm text-zinc-400">Entrar como espectador</span>
          </label>
        )}

        <div className="flex gap-2 pt-1">
          <UBtn variant="ghost" className="flex-1 justify-center" onClick={onClose}>
            Cancelar
          </UBtn>
          <UBtn
            variant="primary"
            icon={isLive ? Eye : LogIn}
            className="flex-1 justify-center"
            onClick={handleJoin}
            disabled={loading}
          >
            {loading ? "Aguarde…" : isLive ? "Espiar" : "Entrar"}
          </UBtn>
        </div>
      </div>
    </UModal>
  );
}

/* ── Session card ── */
function SessionCard({
  session,
  onJoin,
}: {
  session: GameSession;
  onJoin: (s: GameSession) => void;
}) {
  const isLive     = session.status === "Em Andamento";
  const isWaiting  = session.status === "Esperando" || !session.status;
  const full       = (session.jogadores?.length ?? 0) >= (session.maxJogadores ?? Infinity);
  const playerCount = session.jogadores?.length ?? 0;
  const maxPlayers  = session.maxJogadores ?? "?";

  return (
    <div
      className={`relative bg-zinc-900 border rounded-2xl overflow-hidden transition-all cursor-pointer hover:border-green-500/40 hover:shadow-[0_0_28px_-10px_rgba(74,222,128,0.2)] group ${
        isLive ? "border-zinc-700" : "border-zinc-800"
      }`}
      onClick={() => onJoin(session)}
    >
      {/* Live top stripe */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500/0 via-green-400 to-green-500/0" />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isLive && <LiveDot />}
              <h3 className="font-jaro text-base text-zinc-100 truncate group-hover:text-green-300 transition-colors">
                {session.nome || `Sala #${session.id}`}
              </h3>
              {session.protegida && <Lock size={11} className="text-zinc-500 shrink-0" />}
            </div>
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-inconsolata text-[10px] uppercase tracking-wider whitespace-nowrap ${
              isLive
                ? "bg-green-500/10 text-green-300 border-green-500/30"
                : isWaiting
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                : "bg-zinc-700/30 text-zinc-400 border-zinc-600/40"
            }`}
          >
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
            {isLive ? "Ao vivo" : isWaiting ? "Aguardando" : session.status}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-inconsolata text-[10px] uppercase tracking-wider whitespace-nowrap bg-zinc-700/30 text-zinc-400 border-zinc-600/40 capitalize">
            {session.modo}
          </span>
          <span className="font-inconsolata text-xs text-zinc-500">
            R$ {(session.saldoInicial ?? 0).toLocaleString("pt-BR")} inicial
          </span>
        </div>

        {/* Players + action */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex -space-x-1.5 mb-1">
              {(session.jogadores ?? []).slice(0, 5).map((j, i) => (
                <UserAvatar
                  key={i}
                  avatarUrl={j.avatarUrl}
                  avatarUpdatedAt={j.avatarUpdatedAt}
                  nome={j.nome}
                  size="sm"
                />
              ))}
              {playerCount > 5 && (
                <span className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-900 grid place-items-center font-inconsolata text-[9px] text-zinc-400">
                  +{playerCount - 5}
                </span>
              )}
            </div>
            <p className="font-inconsolata text-[10px] text-zinc-500">
              {playerCount}/{maxPlayers} jogadores
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-2 font-inconsolata rounded-xl transition-all whitespace-nowrap px-3 py-1.5 text-xs ${
              isLive
                ? "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
                : full
                ? "border border-zinc-700 text-zinc-500"
                : "bg-green-500 text-zinc-950 font-semibold hover:bg-green-400"
            }`}
          >
            {isLive ? <><Eye size={13} /> Espiar</> : full ? "Cheia" : <><LogIn size={13} /> Entrar</>}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function SessionsPage() {
  const router      = useRouter();
  const { user }    = useAuthStore();
  const { sessions, isLoading } = useSessions();
  const [filter, setFilter]   = useState("Todas");
  const [q, setQ]             = useState("");
  const [joining, setJoining] = useState<GameSession | null>(null);

  /* Redirect if in active session */
  useEffect(() => {
    if (!user) return;
    if (user.isAdmin) { router.replace("/admin/sessoes"); return; }
    sessionsApi
      .getMyActive()
      .then((res) => {
        const s = res.data?.session;
        if (s?.id) router.replace(`/user/game/${s.id}`);
      })
      .catch(() => {});
  }, [user, router]);

  const all = sessions ?? [];

  const counts = {
    Todas:      all.length,
    "Ao vivo":  all.filter((s) => s.status === "Em Andamento").length,
    Aguardando: all.filter((s) => s.status === "Esperando" || !s.status).length,
  };

  const list = all.filter((s) => {
    const matchFilter =
      filter === "Todas" ||
      (filter === "Ao vivo"    && s.status === "Em Andamento") ||
      (filter === "Aguardando" && (s.status === "Esperando" || !s.status));
    const term = q.toLowerCase();
    const matchQ =
      !q ||
      (s.nome ?? "").toLowerCase().includes(term) ||
      String(s.id).includes(q);
    return matchFilter && matchQ;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pt-16 lg:pt-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "Todas",      label: `Todas ${counts.Todas}` },
            { value: "Ao vivo",    label: `Ao vivo ${counts["Ao vivo"]}` },
            { value: "Aguardando", label: `Aguardando ${counts.Aguardando}` },
          ]}
        />
        <UBtn
          variant="primary"
          icon={Plus}
          onClick={() => router.push("/user/new-session")}
        >
          Criar sala
        </UBtn>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou #id"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 pl-9 font-inconsolata text-sm text-zinc-100 focus:outline-none focus:border-green-500 transition-colors placeholder:text-zinc-600"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-3">
          <Users size={40} />
          <p className="font-inconsolata text-sm">
            {q ? "Nenhuma sala encontrada." : "Nenhuma sala disponível."}
          </p>
          <UBtn
            variant="primary"
            icon={Plus}
            onClick={() => router.push("/user/new-session")}
          >
            Criar uma sala
          </UBtn>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {list.map((s) => (
            <motion.div key={s.id} variants={staggerItem}>
              <SessionCard session={s} onJoin={setJoining} />
            </motion.div>
          ))}
        </motion.div>
      )}

      <JoinModal
        session={joining}
        open={!!joining}
        onClose={() => setJoining(null)}
      />
    </div>
  );
}
