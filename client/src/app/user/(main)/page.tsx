'use client';

/**
 * Dashboard do usuário — redesign
 * Salve em: src/app/user/(main)/page.tsx
 *
 * Substitui a versão atual: adiciona hero card com UserBanner, scroll horizontal
 * de salas ativas, missões inline e histórico recente.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, LogIn, ChevronRight, Lock, TrendingUp,
  Coins, Trophy, Gamepad2, Target,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSessions } from "@/hooks/useApi";
import { getProfileHistoryApi } from "@/services/api/profile";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import UserBadge from "@/components/UserBadge";
import { Progress, Chip, Panel, PanelHead, LiveDot, xpForLevel, totalXpForLevels } from "@/components/user/UserUI";
import type { GameSession } from "@/types/game";

/* ── Hero: banner + avatar + XP ── */
function ProfileHero() {
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  if (!profile || !user) return null;

  const xpCurrent  = xpForLevel(profile.level);
  const xpPrevious = totalXpForLevels(profile.level);
  const xpInto     = profile.xp - xpPrevious;
  const pct        = Math.min(Math.round((xpInto / xpCurrent) * 100), 100);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      {/* Banner — inline bg, never absolute so it can't overflow */}
      <div className="h-32 relative">
        <UserBanner
          banner={profile.banner ?? user.banner}
          spriteId={profile.spriteId ?? user.spriteId}
          className="absolute inset-0 w-full h-full rounded-t-2xl"
        />
        <div
          className="absolute inset-0 rounded-t-2xl"
          style={{ background: "linear-gradient(0deg,rgba(9,9,11,.85) 0%,transparent 60%)" }}
        />
      </div>

      {/* Content — avatar overlaps with negative margin (no overflow-hidden on outer) */}
      <div className="px-4 pb-4">
        <div className="flex items-start justify-between -mt-8 mb-2">
          <div className="ring-4 ring-zinc-950 rounded-full z-10 relative">
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              avatarUpdatedAt={profile.avatarUpdatedAt}
              nome={profile.nome}
              size="lg"
              ring
            />
          </div>
          {/* Coins */}
          <div className="text-right pt-8 shrink-0">
            <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5">
              <Coins size={14} className="text-amber-400" />
              <span className="font-jaro text-base text-amber-300">
                {profile.coins.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        {/* Name + title + badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-jaro text-xl text-white whitespace-nowrap">{profile.nome}</h1>
          {profile.title && <Chip tone="emerald">{profile.title}</Chip>}
          <UserBadge badge={profile.badge ?? user.badge} variant="small" />
        </div>
        <p className="font-inconsolata text-xs text-zinc-500 mt-0.5">
          Nível {profile.level} · #{" "}
          <Link href="/user/recompensas" className="hover:text-zinc-300 transition-colors">
            ver ranking
          </Link>
        </p>

        {/* XP bar */}
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

/* ── Quick actions ── */
function QuickActions() {
  const router = useRouter();
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => router.push("/user/new-session")}
        className="flex items-center gap-3 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white rounded-2xl p-4 transition-colors cursor-pointer shadow-[0_0_24px_-8px_rgba(74,222,128,0.5)]"
      >
        <Plus size={22} className="shrink-0" />
        <div className="text-left">
          <p className="font-jaro text-base leading-none">Criar Sala</p>
          <p className="font-inconsolata text-[11px] text-green-200 mt-0.5">Nova partida</p>
        </div>
      </button>
      <button
        onClick={() => router.push("/user/sessions")}
        className="flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl p-4 transition-colors cursor-pointer border border-zinc-700 hover:border-zinc-600"
      >
        <LogIn size={20} className="shrink-0 text-green-400" />
        <div className="text-left">
          <p className="font-jaro text-base leading-none">Entrar em Sala</p>
          <p className="font-inconsolata text-[11px] text-zinc-400 mt-0.5">Ver salas abertas</p>
        </div>
      </button>
    </div>
  );
}

/* ── Live sessions horizontal scroll ── */
function LiveSessions({ sessions }: { sessions: GameSession[] }) {
  const router = useRouter();
  if (!sessions.length) return null;
  const live = sessions.filter(
    (s) => s.status === "Em Andamento" || s.status === "Esperando" || !s.status
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
        className="flex gap-3 overflow-x-auto p-4 pb-3"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        {live.map((s) => {
          const isLive = s.status === "Em Andamento";
          return (
            <button
              key={s.id}
              onClick={() => router.push("/user/sessions")}
              className="shrink-0 w-52 bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 text-left cursor-pointer hover:border-green-500/50 hover:bg-zinc-800 transition-colors"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {isLive ? <LiveDot /> : <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                <span className="font-jaro text-sm text-zinc-100 truncate flex-1">
                  {s.nome || `Sala #${s.id}`}
                </span>
                {s.protegida && <Lock size={11} className="text-zinc-500 shrink-0" />}
              </div>
              <p className="font-inconsolata text-[10px] text-zinc-500 mb-2.5 capitalize">
                {s.modo} · {s.jogadores?.length ?? 0}/{s.maxJogadores ?? "?"} jogadores
              </p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-1.5">
                  {(s.jogadores ?? []).slice(0, 4).map((j: any, i: number) => (
                    <UserAvatar
                      key={i}
                      avatarUrl={j.avatarUrl}
                      avatarUpdatedAt={j.avatarUpdatedAt}
                      nome={j.nome}
                      size="sm"
                    />
                  ))}
                </div>
                <span
                  className={`font-inconsolata text-[10px] px-1.5 py-0.5 rounded-lg ${
                    isLive ? "text-green-400 bg-green-500/10" : "text-amber-400 bg-amber-500/10"
                  }`}
                >
                  {isLive ? "Ao vivo" : "Aguardando"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── Missions preview ── */
function MissionsPreview({ missions }: { missions: any[] }) {
  const router = useRouter();
  const active = missions.filter((m) => !m.completed).slice(0, 3);
  if (!active.length) return null;

  return (
    <Panel flush>
      <PanelHead
        title="Missões em andamento"
        right={
          <button
            onClick={() => router.push("/user/recompensas")}
            className="font-inconsolata text-xs text-green-400 hover:text-green-300 cursor-pointer whitespace-nowrap flex items-center gap-1 pr-4"
          >
            Ver todas <ChevronRight size={12} />
          </button>
        }
      />
      <div className="divide-y divide-zinc-800/60">
        {active.map((m: any) => {
          const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
          return (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-inconsolata text-sm text-zinc-200">{m.name}</span>
                <span className="font-inconsolata text-[10px] text-zinc-500">
                  {Math.floor(m.progress)}/{m.target}
                </span>
              </div>
              <Progress value={m.progress} max={m.target} tone="green" height={5} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── Recent matches ── */
function RecentMatches({ history }: { history: any[] }) {
  const router = useRouter();
  if (!history.length) return null;

  const POS_COLOR: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-zinc-300",
    3: "text-amber-600",
  };

  return (
    <Panel flush>
      <PanelHead
        title="Partidas recentes"
        right={
          <button
            onClick={() => router.push("/user/perfil")}
            className="font-inconsolata text-xs text-green-400 hover:text-green-300 cursor-pointer whitespace-nowrap flex items-center gap-1 pr-4"
          >
            Ver todas <ChevronRight size={12} />
          </button>
        }
      />
      <div className="divide-y divide-zinc-800/60">
        {history.slice(0, 4).map((r: any) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`font-jaro text-xl w-7 text-center shrink-0 ${
                POS_COLOR[r.position] || "text-zinc-500"
              }`}
            >
              #{r.position}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-inconsolata text-sm text-zinc-100 truncate">
                R$ {r.patrimony?.toLocaleString("pt-BR") ?? "—"}
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

/* ── Stats mini-row ── */
function StatsRow({ profile }: { profile: any }) {
  const stats = [
    { icon: Gamepad2, value: profile.totalGames, label: "Partidas",  color: "text-violet-400" },
    { icon: Trophy,   value: profile.totalWins,  label: "Vitórias",  color: "text-yellow-400" },
    { icon: TrendingUp,value: profile.totalTop3, label: "Top 3",     color: "text-amber-400"  },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
            <Icon size={18} className={`mx-auto mb-1 ${s.color}`} />
            <p className="font-jaro text-xl text-white leading-none">{s.value}</p>
            <p className="font-inconsolata text-[10px] text-zinc-500 mt-1">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main page ── */
export default function UserDashboard() {
  const { token, user, loadFromStorage } = useAuthStore();
  const { profile, missions, loading, loadProfile, loadMissions } = useProfileStore();
  const { sessions } = useSessions();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (token) {
      loadProfile();
      loadMissions();
    }
  }, [token, loadProfile, loadMissions]);

  useEffect(() => {
    if (token) {
      getProfileHistoryApi()
        .then(setHistory)
        .catch(() => setHistory([]));
    }
  }, [token]);

  if (loading.profile || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pt-16 lg:pt-6">
      <ProfileHero />
      <QuickActions />
      {sessions && sessions.length > 0 && <LiveSessions sessions={sessions} />}
      <StatsRow profile={profile} />
      {missions.length > 0 && <MissionsPreview missions={missions} />}
      {history.length > 0 && <RecentMatches history={history} />}
    </div>
  );
}
