"use client";

/**
 * UserNav — redesign completo
 * Salve em: src/components/UserNav/index.tsx
 * (substitui o atual em src/components/UserNav/index.tsx)
 *
 * Desktop: header fixo — logo, links de nav (ícone lg / ícone+label xl),
 *          pill coins+nível, relógio, sino de notificações com dropdown, avatar.
 * Mobile:  bottom nav de 5 abas com ícone + label + glow verde no ativo.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { slideUp } from "@/lib/animations";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Store, Gift, Trophy,
  Bell, X,
  Layers,
} from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import DiamondIcon from "@/components/DiamondIcon";
import RankBadge from "@/components/RankBadge";
import TrophyCount from "@/components/TrophyCount";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { useUserNotificationStore } from "@/stores/userNotificationStore";
import UserAvatar from "@/components/UserAvatar";

/* -- Nav tab definitions -- */
const NAV_TABS = [
  { label: "Dashboard",   icon: LayoutDashboard, path: "/user"             },
  { label: "Cofre",       icon: Layers,          path: "/user/cofre"     },
  { label: "Loja",        icon: Store,           path: "/user/loja"        },
  { label: "Recompensas", icon: Gift,            path: "/user/recompensas" },
  { label: "Ranking",     icon: Trophy,          path: "/user/ranking"     },
];

function relativeTime(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/* -- Live clock -- */
function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-inconsolata text-xs text-zinc-500 tabular-nums hidden xl:block select-none">
      {t.toLocaleTimeString("pt-BR")}
    </span>
  );
}

/* -- Notifications dropdown -- */
function NotifBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, load, markAllRead } = useUserNotificationStore();

  useEffect(() => { load(); }, [load]);

  function handleOpen() {
    setOpen((o) => !o);
    if (!open) load();
  }

  async function handleMarkAllRead() {
    await markAllRead();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 text-zinc-400 hover:text-white cursor-pointer rounded-xl hover:bg-zinc-800 transition-colors"
        aria-label="Notificações"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-rose-500 font-inconsolata text-[9px] text-white grid place-items-center leading-none">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              variants={slideUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute right-0 top-full mt-2 w-72 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50"
            >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="font-jaro text-sm text-white">Notificações</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="font-inconsolata text-[10px] text-zinc-500 hover:text-green-400 cursor-pointer transition-colors"
                  >
                    Marcar como lidas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-zinc-500 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-zinc-500">
                <p className="font-inconsolata text-xs">Sem notificações</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-0 transition-colors ${
                      !n.lida ? "bg-green-500/5" : "hover:bg-zinc-900"
                    }`}
                  >
                    {!n.lida && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-inconsolata text-xs text-zinc-100 font-semibold leading-snug truncate">
                        {n.titulo}
                      </p>
                      <p className="font-inconsolata text-[11px] text-zinc-400 leading-snug mt-0.5">
                        {n.corpo}
                      </p>
                    </div>
                    <span className="font-inconsolata text-[9px] text-zinc-600 shrink-0 mt-0.5">
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -- Main component -- */
export default function UserNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, token, loadFromStorage } = useAuthStore();
  const { profile, loadProfile } = useProfileStore();

  // Carrega dados ao montar o componente
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Carrega perfil quando houver token
  useEffect(() => {
    if (token) {
      loadProfile();
    }
  }, [token, loadProfile]);

  const isActive = (path: string) =>
    path === "/user" ? pathname === "/user" : pathname.startsWith(path);

  return (
    <>
      {/* -- Desktop header -- */}
      <header className="hidden lg:flex fixed top-0 left-0 w-full h-16 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 items-center gap-3 px-6 z-50">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group hover:opacity-80 transition-opacity">
          <Image
            src="/images/gamebank-logo.png"
            alt="GameBank"
            width={36}
            height={36}
            className="object-contain"
          />
          <div className="hidden sm:block">
            <p className="font-jaro text-sm text-white leading-none">GameBank</p>
            <p className="font-inconsolata text-[9px] text-green-400 uppercase tracking-[0.2em] mt-0.5">
              Super Gerenciador
            </p>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 ml-4">
          {NAV_TABS.map((tab) => {
            const active = isActive(tab.path);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                href={tab.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-inconsolata text-sm transition-all whitespace-nowrap border ${
                  active
                    ? "bg-green-500/10 text-green-300 border-green-500/25"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border-transparent"
                }`}
              >
                <Icon
                  size={15}
                  style={active ? { filter: "drop-shadow(0 0 6px rgba(74,222,128,0.4))" } : undefined}
                />
                <span className="hidden xl:block">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Coins + Diamonds + Level + Trophies pill */}
        {user && (
          <div className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
            <CoinIcon size={14} className="text-yellow-400" />
            <span className="font-jaro text-sm text-yellow-300">
              {profile ? String(profile.coins) : "—"}
            </span>
            <span className="w-px h-4 bg-zinc-700 mx-1" />
            <DiamondIcon size={14} />
            <span className="font-jaro text-sm text-cyan-300">
              {profile?.diamonds ?? 0}
            </span>
            <span className="w-px h-4 bg-zinc-700 mx-1" />
            <span className="font-jaro text-sm text-green-300">
              Nv.{profile?.level ?? "—"}
            </span>
            <span className="w-px h-4 bg-zinc-700 mx-1" />
            <TrophyCount
              count={profile?.trophies ?? 0}
              size={14}
              textClassName="font-jaro text-sm text-amber-300"
            />
            <RankBadge trophies={profile?.trophies ?? 0} size={20} />
          </div>
        )}

        <Clock />
        <NotifBell />

        {/* Avatar → perfil */}
        {user && (
          <Link href="/user/perfil" className="hover:opacity-80 transition-opacity">
            <UserAvatar
              avatarUrl={user.avatarUrl}
              avatarUpdatedAt={user.avatarUpdatedAt}
              nome={user.nome}
              size="sm"
              frame={user.frame}
              frameType={user.frameType}
              frameAnimated={user.frameAnimated}
              frameScale={user.frameScale ?? 145}
            />
          </Link>
        )}
      </header>

      {/* -- Mobile header -- */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
            <Image
              src="/images/gamebank-logo.png"
              alt="GameBank"
              width={28}
              height={28}
              className="object-contain"
            />
          </Link>

          {/* Right side: coins, clock, notif, avatar */}
          <div className="flex items-center gap-2">
            {/* Coins + Diamonds + Trophies (compact) */}
            {user && (
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
                <CoinIcon size={12} className="text-yellow-400 shrink-0" />
                <span className="font-jaro text-xs text-yellow-300">
                  {profile ? String(profile.coins) : "—"}
                </span>
                <span className="w-px h-3 bg-zinc-700 mx-0.5" />
                <DiamondIcon size={11} />
                <span className="font-jaro text-xs text-cyan-300">
                  {profile?.diamonds ?? 0}
                </span>
                <span className="w-px h-3 bg-zinc-700 mx-0.5" />
                <TrophyCount
                  count={profile?.trophies ?? 0}
                  size={12}
                  textClassName="font-jaro text-xs text-amber-300"
                />
                <RankBadge trophies={profile?.trophies ?? 0} size={16} />
              </div>
            )}

            {/* Clock */}
            <span className="font-inconsolata text-[10px] text-zinc-500 hidden sm:block">
              {(() => {
                const now = new Date();
                return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              })()}
            </span>

            {/* Notif bell (mobile — opens desktop dropdown via same store) */}
            <NotifBell />

            {/* Avatar */}
            {user && (
              <Link href="/user/perfil" className="hover:opacity-80 transition-opacity">
                <UserAvatar
                  avatarUrl={user.avatarUrl}
                  avatarUpdatedAt={user.avatarUpdatedAt}
                  nome={user.nome}
                  size="xs"
                  frame={user.frame}
                  frameType={user.frameType}
                  frameAnimated={user.frameAnimated}
                  frameScale={user.frameScale ?? 145}
                />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* -- Mobile bottom nav -- */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800">
        {/* Mobile — 6 tabs */}
        <ul className="grid grid-cols-5 w-full">
          {NAV_TABS.map((tab) => {
            const active = isActive(tab.path);
            const Icon   = tab.icon;
            return (
              <li key={tab.path}>
                <button
                  type="button"
                  onClick={() => router.push(tab.path)}
                  className={`w-full flex flex-col items-center justify-center py-2.5 gap-0.5 cursor-pointer transition-colors select-none active:scale-95 ${
                    active ? "text-green-400" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Icon
                    size={24}
                    style={
                      active
                        ? { filter: "drop-shadow(0 0 6px rgba(74,222,128,0.5))" }
                        : undefined
                    }
                  />
                  <span className="font-inconsolata text-[10px] font-medium leading-none">
                    {tab.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
