/* eslint-disable */
'use client';

import { useEffect, useRef, useState } from "react";
import { animateStaggerIn } from "@/lib/animations";
import { Loader2, Pencil, Settings, Gamepad2, Crown, Trophy, TrendingUp } from "lucide-react";
import RankBadge from "@/components/RankBadge";
import TrophyCount from "@/components/TrophyCount";
import RankProgressModal from "@/components/RankProgressModal";
import { getTrophyLabel } from "@/utils/trophies";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { getProfileHistoryApi, clearProfileHistoryApi } from "@/services/api/profile";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import UserName from "@/components/UserName";
import EditProfileModal from "@/components/EditProfileModal";
import { Progress, Chip, Panel, PanelHead, xpForLevel } from "@/components/user/UserUI";
import type { GameResult } from "@/types/shop";

/* --- Hero ---------------------------------------------------------------- */
function ProfileHero({ onEdit, onOpenRank }: { onEdit: () => void; onOpenRank: () => void }) {
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
        <button
          onClick={onEdit}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 font-inconsolata text-xs bg-black/50 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 cursor-pointer backdrop-blur-sm transition-colors"
        >
          <Pencil size={12} />Editar perfil
        </button>
      </div>

      <div className="px-4 pb-5">
        <div className="flex items-start justify-between -mt-9 mb-2">
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
          <div className="text-right pt-10 shrink-0 flex flex-col items-end gap-2">
            <Link
              href="/user/configuracoes"
              className="text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Configurações"
            >
              <Settings size={16} />
            </Link>
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
          className="mt-1 flex-wrap"
        />
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-inconsolata text-xs text-zinc-500">
            Nível {profile.level} · #{profile.id}
          </span>
        </div>

        <div className="mt-3">
          <div className="flex justify-between font-inconsolata text-[10px] text-zinc-500 mb-1.5">
            <span>{xpInto.toLocaleString("pt-BR")} XP</span>
            <span>{pct}% → nível {profile.level + 1}</span>
          </div>
          <Progress value={xpInto} max={xpCurrent} tone="green" height={6} />
        </div>

        <button
          onClick={onOpenRank}
          className="mt-3 flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/60 hover:border-zinc-700 rounded-xl px-3 py-2 w-fit transition-colors cursor-pointer group"
        >
          <RankBadge trophies={profile.trophies ?? 0} size={24} />
          <div className="text-left">
            <p className="font-jaro text-sm text-zinc-100 leading-none">{getTrophyLabel(profile.trophies ?? 0)}</p>
            <TrophyCount count={profile.trophies ?? 0} size={11} textClassName="font-inconsolata text-[9px] text-zinc-400" />
          </div>
          <span className="font-inconsolata text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors ml-1">
            ver tudo →
          </span>
        </button>
      </div>
    </div>
  );
}

/* --- Stats --------------------------------------------------------------- */
function StatsRow({
  totalGames,
  totalWins,
  totalTop3,
}: {
  totalGames: number;
  totalWins: number;
  totalTop3: number;
}) {
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const stats = [
    { Icon: Gamepad2,  value: totalGames,       label: "Partidas",  color: "text-violet-400" },
    { Icon: Crown,     value: totalWins,         label: "Vitórias",  color: "text-yellow-400" },
    { Icon: Trophy,    value: totalTop3,          label: "Top 3",     color: "text-amber-400"  },
    { Icon: TrendingUp,value: `${winRate}%`,     label: "Win Rate",  color: "text-green-400"  },
  ];

  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll<HTMLElement>(".stagger-item");
    animateStaggerIn(items);
  }, []);

  return (
    <div ref={containerRef} className="grid grid-cols-4 gap-3">
      {stats.map(({ Icon, value, label, color }) => (
        <div key={label} className="stagger-item opacity-0 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
          <Icon size={16} className={`mx-auto mb-1 ${color}`} />
          <p className="font-jaro text-xl text-white leading-none">{value}</p>
          <p className="font-inconsolata text-[10px] text-zinc-500 mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* --- Match history list (animada via GSAP) -------------------------------- */
function HistoryList({ history, POS_COLOR }: { history: GameResult[]; POS_COLOR: Record<number, string> }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll<HTMLElement>(".stagger-item");
    animateStaggerIn(items);
  }, [history]);

  return (
    <div ref={containerRef} className="divide-y divide-zinc-800/60">
      {history.map((r) => (
        <div key={r.id} className="stagger-item opacity-0 flex items-center gap-3 px-4 py-3">
          <span className={`font-jaro text-xl w-7 text-center shrink-0 ${POS_COLOR[r.position] ?? "text-zinc-500"}`}>
            #{r.position}
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
            {r.trophyDelta !== undefined && (
              <p className={`font-inconsolata text-[10px] ${(r.trophyDelta ?? 0) >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
                {(r.trophyDelta ?? 0) >= 0 ? "+" : ""}{r.trophyDelta} 🏆
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --- Match history ------------------------------------------------------- */
function MatchHistory({ history, onClear }: { history: GameResult[]; onClear?: () => void }) {
  const POS_COLOR: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-zinc-300",
    3: "text-amber-600",
  };
  const [clearing, setClearing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <Panel flush>
      <PanelHead
        title="Histórico de partidas"
        sub={`${history.length} partidas registradas`}
        right={
          history.length > 0 && !confirm ? (
            <button onClick={() => setConfirm(true)}
              className="font-inconsolata text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer">
              Limpar
            </button>
          ) : confirm ? (
            <div className="flex items-center gap-2">
              <span className="font-inconsolata text-[11px] text-zinc-500">Tem certeza?</span>
              <button onClick={async () => { setClearing(true); try { await onClear?.(); } finally { setConfirm(false); setClearing(false); } }}
                disabled={clearing}
                className="font-inconsolata text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer">
                {clearing ? "Limpando…" : "Sim"}
              </button>
              <button onClick={() => setConfirm(false)}
                className="font-inconsolata text-[11px] text-zinc-400 hover:text-zinc-300 transition-colors cursor-pointer">
                Não
              </button>
            </div>
          ) : null
        }
      />
      {history.length === 0 ? (
        <p className="font-inconsolata text-sm text-zinc-600 text-center py-10">
          Nenhuma partida disputada ainda.
        </p>
      ) : (
        <HistoryList history={history} POS_COLOR={POS_COLOR} />
      )}
    </Panel>
  );
}

/* --- Page ---------------------------------------------------------------- */
export default function PerfilPage() {
  const { user, token, loadFromStorage } = useAuthStore();
  const { profile, loading, loadProfile } = useProfileStore();
  const [history, setHistory] = useState<GameResult[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (token) {
      loadProfile();
      getProfileHistoryApi()
        .then(setHistory)
        .catch(() => setHistory([]));
    }
  }, [token, loadProfile]);

  if (!user || !token) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-inconsolata text-sm text-zinc-500">
        Faça login para ver seu perfil.
      </div>
    );
  }

  if (loading.profile || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pt-16 lg:pt-6 space-y-4">
      <ProfileHero onEdit={() => setEditOpen(true)} onOpenRank={() => setRankOpen(true)} />
      <StatsRow
        totalGames={profile.totalGames}
        totalWins={profile.totalWins}
        totalTop3={profile.totalTop3}
      />
      <MatchHistory history={history} onClear={async () => {
        await clearProfileHistoryApi();
        setHistory([]);
      }} />
      <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} />
      <RankProgressModal
        trophies={profile.trophies ?? 0}
        isOpen={rankOpen}
        onClose={() => setRankOpen(false)}
      />
    </div>
  );
}
