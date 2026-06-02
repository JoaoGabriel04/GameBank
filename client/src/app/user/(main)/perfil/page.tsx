'use client';

/**
 * Perfil — redesign
 * Salve em: src/app/user/(main)/perfil/page.tsx
 *
 * Melhorias vs atual:
 * - Hero: UserBanner sem overflow-hidden bug, sprite visível, avatar sem clip
 * - Nome em linha única, título + badge na linha abaixo
 * - Inventário por tipo (Títulos / Emblemas / Banners) com equip/desequip
 * - Histórico de partidas full
 * - Mantém EditProfileModal, UserAvatar, UserBanner, UserBadge, BadgeCollection
 */

import { useEffect, useState } from "react";
import { Loader2, Pencil, Settings, Gamepad2, Crown, Trophy, TrendingUp, Clock } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { buyShopItemApi, equipShopItemApi } from "@/services/api/shop";
import { getProfileHistoryApi } from "@/services/api/profile";
import { useToast } from "@/components/Toast";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import UserBadge from "@/components/UserBadge";
import BadgeCollection from "@/components/BadgeCollection";
import EditProfileModal from "@/components/EditProfileModal";
import { Progress, Chip, Panel, PanelHead, xpForLevel, totalXpForLevels } from "@/components/user/UserUI";
import type { UserItem, UserMission, GameResult } from "@/types/shop";

/* ─── Inventory type tabs ─── */
type InvTab = "title" | "badge" | "banner";

const INV_TABS: { id: InvTab; label: string }[] = [
  { id: "title", label: "Títulos" },
  { id: "badge", label: "Emblemas" },
  { id: "banner", label: "Banners" },
];

const INV_ACCENT: Record<InvTab, { color: string; ring: string }> = {
  title: { color: "#a78bfa", ring: "border-violet-500/50 bg-violet-500/5" },
  badge: { color: "#22d3ee", ring: "border-cyan-500/50 bg-cyan-500/5" },
  banner: { color: "#34d399", ring: "border-emerald-500/50 bg-emerald-500/5" },
};

/* ─── Profile hero ─── */
function ProfileHero({ onEdit }: { onEdit: () => void }) {
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  if (!profile || !user) return null;

  const xpCurrent = xpForLevel(profile.level);
  const xpPrevious = totalXpForLevels(profile.level);
  const xpInto = profile.xp - xpPrevious;
  const pct = Math.min(Math.round((xpInto / xpCurrent) * 100), 100);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
      {/* Banner (not overflow-hidden so avatar clip never happens) */}
      <div className="h-32 rounded-t-2xl relative overflow-hidden">
        <UserBanner
          banner={profile.banner ?? user.banner}
          spriteId={profile.spriteId ?? user.spriteId}
          className="absolute inset-0 w-full h-full"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(0deg,rgba(9,9,11,.85) 0%,transparent 60%)" }}
        />
        {/* Edit button */}
        <button
          onClick={onEdit}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 font-inconsolata text-xs bg-black/50 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 cursor-pointer backdrop-blur-sm transition-colors"
        >
          <Pencil size={12} />Editar perfil
        </button>
      </div>

      {/* Content below banner — avatar overlaps via negative margin */}
      <div className="px-4 pb-5">
        <div className="flex items-start justify-between -mt-9 mb-2">
          {/* Avatar with ring forms its own circular clip */}
          <div className="ring-4 ring-zinc-950 rounded-full z-10 relative">
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              avatarUpdatedAt={profile.avatarUpdatedAt}
              nome={profile.nome}
              size="lg"
              ring
            />
          </div>
          {/* Coins top-right */}
          <div className="text-right pt-10 shrink-0 flex flex-col items-end gap-2">

            <div className="inline-flex items-center gap-1.5 rounded-xl">
              <span className="font-jaro text-base text-amber-300">
                {profile.coins.toLocaleString("pt-BR")}
              </span>
              <span className="font-inconsolata text-[10px] text-amber-500">coins</span>
            </div>

            <Link
              href="/user/configuracoes"
              className="text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Configurações"
            >
              <Settings size={16} />
            </Link>

          </div>
        </div>

        {/* Name row — never wraps the name */}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h1 className="font-jaro text-xl text-white whitespace-nowrap">{profile.nome}</h1>
          <UserBadge badge={profile.badge ?? user.badge} variant="small" />
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {profile.title && <Chip tone="emerald">{profile.title}</Chip>}
          <span className="font-inconsolata text-xs text-zinc-500">
            Nível {profile.level} · #{profile.id}
          </span>
        </div>

        {/* XP progress */}
        <div className="mt-3">
          <div className="flex justify-between font-inconsolata text-[10px] text-zinc-500 mb-1.5">
            <span>{xpInto.toLocaleString("pt-BR")} XP</span>
            <span>{pct}% → nível {profile.level + 1}</span>
          </div>
          <Progress value={xpInto} max={xpCurrent} tone="green" height={6} />
        </div>
      </div>
    </div>
  );
}

/* ─── Stats row ─── */
interface ProfileStats {
  totalGames: number;
  totalWins: number;
  totalTop3: number;
}

function StatsRow({ profile }: { profile: ProfileStats }) {
  const stats = [
    { icon: Gamepad2, value: profile.totalGames, label: "Partidas", color: "text-violet-400" },
    { icon: Crown, value: profile.totalWins, label: "Vitórias", color: "text-yellow-400" },
    { icon: Trophy, value: profile.totalTop3, label: "Top 3", color: "text-amber-400" },
    {
      icon: TrendingUp, value: profile.totalGames > 0
        ? Math.round((profile.totalWins / profile.totalGames) * 100) + "%"
        : "0%",
      label: "Win Rate", color: "text-green-400"
    },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map(({ icon: Icon, value, label, color }) => (
        <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
          <Icon size={16} className={`mx-auto mb-1 ${color}`} />
          <p className="font-jaro text-xl text-white leading-none">{value}</p>
          <p className="font-inconsolata text-[10px] text-zinc-500 mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Inventory with type tabs ─── */
function Inventory({ profile, onRefresh }: { profile: { items: UserItem[]; banner?: string | null }; onRefresh: () => void }) {
  const [tab, setTab] = useState<InvTab>("title");
  const [equipping, setEq] = useState<number | null>(null);
  const { success: ok, error: err } = useToast();
  const { loadProfile } = useProfileStore();

  const items: UserItem[] = profile.items ?? [];
  const acc = INV_ACCENT[tab];

  const owned = items.filter((i) => i.type === tab);

  async function handleEquip(item: UserItem) {
    setEq(item.id);
    try {
      await equipShopItemApi(item.id);
      const wasEquipped = item.equipped;
      ok(wasEquipped ? `"${item.name}" desequipado.` : `"${item.name}" equipado!`);
      loadProfile();
    } catch {
      err("Erro ao equipar item.");
    } finally {
      setEq(null);
    }
  }

  return (
    <Panel flush>
      <PanelHead
        title="Inventário"
        sub="Seus cosméticos"
        right={
          <div className="flex gap-1 p-1 mr-1">
            {INV_TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-2.5 py-1 rounded-lg font-inconsolata text-[11px] cursor-pointer transition-all ${tab === id
                    ? "text-white font-semibold"
                    : "text-zinc-500 hover:text-zinc-300"
                  }`}
                style={tab === id ? { background: INV_ACCENT[id].color + "22", color: INV_ACCENT[id].color } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-4">
        {owned.length === 0 ? (
          <p className="font-inconsolata text-sm text-zinc-600 italic text-center py-4">
            Você não possui {INV_TABS.find((t) => t.id === tab)?.label.toLowerCase()} ainda.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {owned.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleEquip(item)}
                className={`relative rounded-xl border p-3 text-left transition-all cursor-pointer ${item.equipped
                    ? acc.ring
                    : "border-zinc-700 bg-zinc-800/60 hover:border-zinc-500"
                  }`}
              >
                {item.equipped && (
                  <span
                    className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{ background: acc.color }}
                  />
                )}
                {/* Banner preview */}
                {item.type === "banner" && item.value && (
                  <UserBanner
                    banner={item.value}
                    className="h-10 rounded-lg mb-2 w-full"
                  />
                )}
                <p
                  className="font-jaro text-sm leading-tight"
                  style={{ color: item.type === "banner" && item.value ? item.value : "#f4f4f5" }}
                >
                  {item.name}
                </p>
                <p className="font-inconsolata text-[9px] text-zinc-500 mt-0.5">
                  {item.equipped
                    ? "✓ Equipado — clique para desequipar"
                    : "Clique para equipar"}
                </p>
                {equipping === item.id && (
                  <div className="absolute inset-0 grid place-items-center bg-zinc-900/80 rounded-xl">
                    <Loader2 size={16} className="animate-spin text-green-400" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* BadgeCollection for badges tab */}
        {tab === "badge" && (
          <div className="mt-4">
            <BadgeCollection
              userBadges={items
                .filter((i) => i.type === "badge")
                .map((i) => {
                  try { return JSON.parse(i.value ?? "")?.badge; } catch { return null; }
                })
                .filter(Boolean)}
              isOwner
            />
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ─── Match history ─── */
function MatchHistory({ history }: { history: GameResult[] }) {
  const POS_COLOR: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-zinc-300",
    3: "text-amber-600",
  };
  return (
    <Panel flush>
      <PanelHead
        title="Histórico de partidas"
        sub={`${history.length} partidas registradas`}
      />
      {history.length === 0 ? (
        <p className="font-inconsolata text-sm text-zinc-600 text-center py-10">
          Nenhuma partida disputada ainda.
        </p>
      ) : (
        <div className="divide-y divide-zinc-800/60">
          {history.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`font-jaro text-xl w-7 text-center shrink-0 ${POS_COLOR[r.position] || "text-zinc-500"
                  }`}
              >
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
                <p className="font-inconsolata text-[10px] text-amber-400">
                  +{r.coinsEarned} coins
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ─── Main page ─── */
export default function PerfilPage() {
  const { user, token, loadFromStorage } = useAuthStore();
  const { profile, loading, loadProfile } = useProfileStore();
  const [history, setHistory] = useState<GameResult[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (token && !profile) loadProfile();
  }, [token, profile, loadProfile]);

  // Reload profile and history when page opens to ensure fresh data
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
      <div className="flex items-center justify-center min-h-[60vh] text-zinc-500 font-inconsolata text-sm">
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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pt-16 lg:pt-6">
      <ProfileHero onEdit={() => setEditOpen(true)} />
      <StatsRow profile={profile} />
      <Inventory profile={profile} onRefresh={loadProfile} />
      <MatchHistory history={history} />
      <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
