/* eslint-disable */
'use client';

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { slideUp, animateStaggerIn } from "@/lib/animations";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, LogIn, ChevronRight, Lock, Gamepad2,
  Target,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { useBauStore } from "@/stores/bauStore";
import { useSessions } from "@/hooks/useApi";
import { getProfileHistoryApi } from "@/services/api/profile";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import UserName from "@/components/UserName";
import { useToast } from "@/components/Toast";
import {
  Progress, Chip, Panel, PanelHead, LiveDot,
  xpForLevel,
} from "@/components/user/UserUI";
import type { GameSession } from "@/types/game";
import type { GameResult } from "@/types/shop";
import type { BauResultado } from "@/components/BauAbertura";
import BauAbertura from "@/components/BauAbertura";
import BauAdquiridoCard from "@/components/BauAdquiridoCard";

/* --- Profile hero -------------------------------------------------------- */
function ProfileHero() {
  const { user }    = useAuthStore();
  const { profile } = useProfileStore();
  if (!profile || !user) return null;

  const xpCurrent = xpForLevel(profile.level);
  const xpInto    = profile.xp;
  const pct       = Math.min(Math.round((xpInto / xpCurrent) * 100), 100);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="h-32 rounded-t-2xl relative overflow-hidden">
        <UserBanner
          banner={profile.banner ?? user.banner}
          animated={profile.bannerAnimated}
          rarity={profile.bannerRaridade}
          className="absolute inset-0 w-full h-full"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(0deg,rgba(9,9,11,.85) 0%,transparent 60%)" }}
        />
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-start justify-between -mt-8 mb-2">
          <div className="ring-4 ring-zinc-950 rounded-full z-10 relative">
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              avatarUpdatedAt={profile.avatarUpdatedAt}
              nome={profile.nome}
              size="lg"
              ring
              frame={profile.frame}
              frameType={profile.frameType}
              frameAnimated={profile.frameAnimated}
              frameScale={profile.frameScale ?? 145}
            />
          </div>

        </div>

        <UserName
          nome={profile.nome}
          badge={profile.badge ?? user.badge}
          badgeImageUrl={profile.badgeImageUrl ?? user.badgeImageUrl}
          title={profile.title}
          titleAnimated={profile.titleAnimated}
          titleRaridade={profile.titleRaridade}
          badgeVariant="small"
          className="flex-wrap"
        />
        <p className="font-inconsolata text-xs text-zinc-500 mt-0.5">
          Nível {profile.level} · <Link href="/user/ranking" className="hover:text-zinc-300 transition-colors">ver ranking</Link>
        </p>

        <div className="mt-3">
          <div className="flex justify-between font-inconsolata text-[10px] text-zinc-500 mb-1.5">
            <span>{xpInto.toLocaleString("pt-BR")} XP neste nível</span>
            <span>{pct}% → nível {profile.level + 1}</span>
          </div>
          <Progress value={xpInto} max={xpCurrent} tone="green" height={6} />
        </div>
      </div>
    </div>
  );
}

/* --- Active game banner -------------------------------------------------- */
function ActiveGameBanner({ session }: { session: GameSession }) {
  const router = useRouter();
  return (
    <div className="relative overflow-hidden rounded-xl border border-green-500/40 bg-green-500/5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(74,222,128,0.08),transparent_70%)]" />
      <div className="relative z-10 flex items-center gap-4 p-4">
        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
          <Gamepad2 className="w-6 h-6 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-jaro text-sm text-zinc-100">Você está em uma partida!</p>
          <p className="font-inconsolata text-xs text-zinc-400 mt-0.5 truncate">{session.nome}</p>
        </div>
        <button
          onClick={() => router.push(`/user/game/${session.id}`)}
          className="shrink-0 bg-green-600 hover:bg-green-500 text-white font-inconsolata text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

/* --- Quick actions ------------------------------------------------------- */
function QuickActions({ activeSession }: { activeSession: GameSession | null }) {
  const router = useRouter();
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => !activeSession && router.push("/user/new-session")}
        disabled={!!activeSession}
        className={`flex items-center gap-3 rounded-2xl p-4 transition-colors cursor-pointer text-left ${
          activeSession
            ? "bg-zinc-900 opacity-50 cursor-not-allowed border border-zinc-800"
            : "bg-green-600 hover:bg-green-500 active:bg-green-700 text-white shadow-[0_0_24px_-8px_rgba(74,222,128,0.5)]"
        }`}
      >
        <Plus size={22} className="shrink-0" />
        <div className="text-left">
          <p className="font-jaro text-base leading-none">Criar Sala</p>
          <p className="font-inconsolata text-[11px] text-green-200 mt-0.5">
            {activeSession ? "Já está em uma partida" : "Nova partida"}
          </p>
        </div>
      </button>
      <button
        onClick={() => router.push(activeSession ? `/user/game/${activeSession.id}` : "/user/sessions")}
        className={`flex items-center gap-3 rounded-2xl p-4 transition-colors cursor-pointer text-left border ${
          activeSession
            ? "bg-green-600 hover:bg-green-500 text-white border-green-500/40 shadow-[0_0_24px_-8px_rgba(74,222,128,0.5)]"
            : "bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-700 hover:border-zinc-600"
        }`}
      >
        <LogIn size={20} className="shrink-0 text-green-400" />
        <div className="text-left">
          <p className="font-jaro text-base leading-none">
            {activeSession ? "Continuar Partida" : "Entrar em Sala"}
          </p>
          <p className={`font-inconsolata text-[11px] mt-0.5 ${activeSession ? "text-green-200" : "text-zinc-400"}`}>
            {activeSession ? activeSession.nome : "Ver salas abertas"}
          </p>
        </div>
      </button>
    </div>
  );
}

/* --- Live sessions ------------------------------------------------------- */
function LiveSessions({ sessions, activeSessionId }: { sessions: GameSession[]; activeSessionId?: number | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll<HTMLElement>(".stagger-item");
    animateStaggerIn(items);
  }, [sessions]);
  const router = useRouter();
  const live = sessions.filter(s =>
    s.status === "Em Andamento" || s.status === "Esperando"
  );
  if (!live.length) return null;

  return (
    <Panel flush>
      <PanelHead
        title="Salas abertas"
        sub={`${live.length} disponíveis agora`}
        right={
          <button
            onClick={() => router.push("/user/sessions")}
            className="font-inconsolata text-xs text-green-400 hover:text-green-300 cursor-pointer whitespace-nowrap flex items-center gap-1 pr-4"
          >
            Ver todas <ChevronRight size={12} />
          </button>
        }
      />
      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto p-4 pb-3"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
      >
        {live.map(s => {
          const isLive = s.status === "Em Andamento";
          const isBlocked = !!activeSessionId && s.id !== activeSessionId;
          return (
            <div key={s.id} className="stagger-item opacity-0">
              <button
                onClick={() => !isBlocked && router.push(isLive ? `/user/game/${s.id}` : "/user/sessions")}
                disabled={isBlocked}
                className={`shrink-0 bg-zinc-800/60 border rounded-xl p-3 cursor-pointer transition-colors text-left ${
                  isBlocked
                    ? "border-zinc-800 opacity-40 cursor-not-allowed"
                    : "border-zinc-700 hover:border-green-500/40"
                }`}
                style={{ width: 220, scrollSnapAlign: "start" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isLive ? <LiveDot /> : <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                  <span className="font-jaro text-sm text-zinc-100 truncate flex-1">{s.nome}</span>
                  {s.protegida && <Lock size={11} className="text-zinc-500 shrink-0" />}
                </div>
                <p className="font-inconsolata text-[10px] text-zinc-500 mb-3 capitalize">
                  {s.modo ?? "individual"} · {s.jogadores?.length ?? 0}/{s.maxJogadores ?? "?"}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {(s.jogadores ?? []).slice(0, 4).map((j, i) => (
                      <UserAvatar key={i} avatarUrl={j.avatarUrl} avatarUpdatedAt={j.avatarUpdatedAt} nome={j.nome} size="xs" frame={j.frame} frameType={j.frameType} frameAnimated={j.frameAnimated} frameScale={j.frameScale ?? 145} />
                    ))}
                  </div>
                  <span className={`font-inconsolata text-[10px] px-1.5 py-0.5 rounded-lg ${
                    isBlocked
                      ? "text-zinc-600 bg-zinc-800"
                      : isLive
                        ? "text-green-400 bg-green-500/10"
                        : "text-amber-400 bg-amber-500/10"
                  }`}>
                    {isBlocked ? "Em jogo" : isLive ? `${(s as unknown as { duracaoMin?: number }).duracaoMin ?? 0}min` : "Livre"}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* --- Missions preview ---------------------------------------------------- */
function MissionsPreview() {
  const { missions } = useProfileStore();
  const router = useRouter();
  const active = missions.filter(m => !m.claimed).slice(0, 3);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll<HTMLElement>(".stagger-item");
    animateStaggerIn(items);
  }, [active.length]);
  if (!active.length) return null;

  return (
    <Panel flush>
      <PanelHead
        title="Missões"
        sub="Progresso atual"
        right={
          <button
            onClick={() => router.push("/user/recompensas")}
            className="font-inconsolata text-xs text-green-400 hover:text-green-300 cursor-pointer whitespace-nowrap flex items-center gap-1 pr-4"
          >
            Ver todas <ChevronRight size={12} />
          </button>
        }
      />
      <div ref={containerRef} className="divide-y divide-zinc-800/60">
        {active.map(m => {
          return (
            <div key={m.id} className="stagger-item opacity-0 px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-green-400 shrink-0" />
                  <span className="font-inconsolata text-sm text-zinc-200">{m.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.completed && !m.claimed && (
                    <Chip tone="green" dot>Resgatar!</Chip>
                  )}
                  <span className="font-inconsolata text-xs text-zinc-500">
                    {Math.min(m.progress, m.target).toLocaleString("pt-BR")}/{m.target.toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
              <Progress value={Math.min(m.progress, m.target)} max={m.target} tone="green" height={5} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* --- Recent games -------------------------------------------------------- */
function RecentGames({ history }: { history: GameResult[] }) {
  const POS_COLOR: Record<number, string> = {
    1: "text-yellow-400", 2: "text-zinc-300", 3: "text-amber-600",
  };
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll<HTMLElement>(".stagger-item");
    animateStaggerIn(items);
  }, [history.length]);
  if (!history.length) return null;

  return (
    <Panel flush>
      <PanelHead title="Partidas recentes" sub="Suas últimas sessões" />
      <div ref={containerRef} className="divide-y divide-zinc-800/60">
        {history.slice(0, 5).map(r => (
          <div key={r.id} className="stagger-item opacity-0 flex items-center gap-3 px-4 py-3">
            <span className={`font-jaro text-xl w-7 text-center shrink-0 ${POS_COLOR[r.position] ?? "text-zinc-500"}`}>
              {r.position}º
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-inconsolata text-sm text-zinc-100 truncate">
                R$ {(r.patrimony ?? 0).toLocaleString("pt-BR")}
              </p>
              <p className="font-inconsolata text-[10px] text-zinc-500">
                {new Date(r.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <p className="font-inconsolata text-xs text-green-400">+{r.xpEarned} XP</p>
              <p className="font-inconsolata text-[10px] text-amber-400">+{r.coinsEarned} coins</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* --- Cofres adquiridos --------------------------------------------------- */
function CofresSection() {
  const { adquiridos, loading, abrindoId, ultimoResultado, loadAdquiridos, abrirAdquirido, limparUltimoResultado } = useBauStore();
  const { success: toastSuccess, error: toastError } = useToast();
  const [resultado, setResultado] = useState<BauResultado | null>(null);

  useEffect(() => { loadAdquiridos(); }, [loadAdquiridos]);

  // Recovery: se o usuário deu refresh durante a animação, reexibe
  useEffect(() => {
    if (ultimoResultado && !resultado) {
      setResultado(ultimoResultado);
    }
  }, [ultimoResultado, resultado]);

  const visiveis = adquiridos.slice(0, 4);
  const slots = Array.from({ length: 4 }, (_, i) => visiveis[i] ?? null);

  return (
    <>
      <Panel flush>
        <PanelHead title="Cofres adquiridos" sub="Ganhos em partidas" />
        <div className="grid grid-cols-4 gap-3 p-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="rounded-xl animate-pulse"
                style={{ background: "#111113", minHeight: 152 }}
              />
            ))
          ) : (
            slots.map((b, i) =>
              b ? (
                <BauAdquiridoCard
                  key={b.id}
                  bau={b}
                  abrindo={abrindoId === b.id}
                  onAbrir={async () => {
                    try {
                      const res = await abrirAdquirido(b.id);
                      setResultado(res);
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : "Erro ao abrir baú";
                      toastError(msg);
                    }
                  }}
                />
              ) : (
                <div
                  key={`empty-${i}`}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl p-3 text-center"
                  style={{ background: "#111113", border: "1px dashed #27272a", minHeight: 152 }}
                >
                  <span className="font-inconsolata text-[11px] text-zinc-600 leading-relaxed">
                    Ganhe Cofres<br />ganhando partidas
                  </span>
                </div>
              )
            )
          )}
        </div>
      </Panel>
      {resultado && (
        <BauAbertura
          resultado={resultado}
          onClose={() => {
            const res = resultado;
            setResultado(null);
            limparUltimoResultado();
            loadAdquiridos();
            const totalItens = res.itens.length;
            const completos = res.itens.filter((i) => i.itemCompleto).length;
            const partes = [`+${res.coinsGanhos.toLocaleString("pt-BR")} coins`];
            if (res.xpBonus) partes.push(`+${res.xpBonus} XP`);
            if (totalItens > 0) {
              partes.push(`${totalItens} item(ns)`);
              if (completos > 0) partes.push(`${completos} desbloqueado(s)!`);
            }
            toastSuccess(`Baú aberto: ${partes.join(", ")}`);
          }}
        />
      )}
    </>
  );
}

/* --- Page ---------------------------------------------------------------- */
export default function DashboardPage() {
  const { user, token, loadFromStorage } = useAuthStore();
  const { profile, loading, loadProfile, loadMissions } = useProfileStore();
  const { sessions } = useSessions();
  const [history, setHistory] = useState<GameResult[]>([]);

  const activeSession = useMemo(() => {
    if (!user || !sessions?.length) return null;
    return sessions.find(s =>
      s.status === "Em Andamento" &&
      s.jogadores?.some(j => j.userId === user.id)
    ) ?? null;
  }, [user, sessions]);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (token) {
      if (!profile) loadProfile();
      loadMissions();
      getProfileHistoryApi()
        .then(setHistory)
        .catch(() => setHistory([]));
    }
  }, [token, profile, loadProfile, loadMissions]);

  if (!token || loading.profile || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pt-16 lg:pt-6 space-y-4">
      <ProfileHero />
      <AnimatePresence>
        {activeSession && (
          <motion.div variants={slideUp} initial="hidden" animate="visible" exit="exit">
            <ActiveGameBanner session={activeSession} />
          </motion.div>
        )}
      </AnimatePresence>
      <QuickActions activeSession={activeSession} />
      <CofresSection />
      <LiveSessions sessions={sessions ?? []} activeSessionId={activeSession?.id} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MissionsPreview />
        <RecentGames history={history} />
      </div>
    </div>
  );
}
