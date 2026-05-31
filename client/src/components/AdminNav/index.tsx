"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStore, faUsers, faServer, faBullseye, faGaugeHigh,
} from "@fortawesome/free-solid-svg-icons";
import { ExternalLink } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import UserAvatar from "@/components/UserAvatar";

const ADMIN_TABS = [
  { label: "Dashboard", icon: faGaugeHigh, path: "/admin" },
  { label: "Loja",      icon: faStore,     path: "/admin/loja" },
  { label: "Usuários",  icon: faUsers,     path: "/admin/usuarios" },
  { label: "Sessões",   icon: faServer,    path: "/admin/sessoes" },
  { label: "Missões",   icon: faBullseye,  path: "/admin/recompensas" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  const isActive = (path: string) =>
    path === "/admin" ? pathname === "/admin" : pathname.startsWith(path);

  return (
    <>
      {/* Desktop — sidebar lateral */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-56 bg-zinc-950 border-r border-zinc-800 flex-col z-50">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
          <Link href="/admin">
            <Image src="/images/gamebank-logo.png" alt="GameBank" width={80} height={80} className="w-10" />
          </Link>
          <div>
            <span className="font-jaro text-zinc-100 text-sm block leading-none">GameBank</span>
            <span className="font-inconsolata text-[10px] text-violet-400 uppercase tracking-widest">Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {ADMIN_TABS.map((tab) => (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-inconsolata transition-colors ${
                isActive(tab.path)
                  ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <FontAwesomeIcon icon={tab.icon} className="w-4" />
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-zinc-800 space-y-2">
          <Link
            href="/user"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-inconsolata text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Voltar ao site
          </Link>
          {user && (
            <div className="flex items-center gap-2 px-3 py-2">
              <UserAvatar avatarUrl={user.avatarUrl} avatarUpdatedAt={user.avatarUpdatedAt} nome={user.nome} size="sm" />
              <span className="font-inconsolata text-xs text-zinc-400 truncate">{user.nome}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile — bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800">
        <ul className="grid grid-cols-5 w-full">
          {ADMIN_TABS.map((tab) => (
            <li
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center justify-center py-3 gap-0.5 cursor-pointer transition-colors select-none active:scale-95 ${
                isActive(tab.path) ? "text-violet-400" : "text-zinc-500"
              }`}
            >
              <FontAwesomeIcon icon={tab.icon} className="text-xl" />
              <span className="text-[9px] font-inconsolata font-medium">{tab.label}</span>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
