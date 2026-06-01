"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStore, faGift, faUsers, faChartLine, faUser,
} from "@fortawesome/free-solid-svg-icons";
import { useAuthStore } from "@/stores/authStore";
import UserAvatar from "@/components/UserAvatar";
import Button1 from "@/components/Button01";

const NAV_TABS = [
  { label: "Dashboard",   icon: faChartLine, path: "/user" },
  { label: "Salas",       icon: faUsers,     path: "/user/sessions" },
  { label: "Loja",        icon: faStore,     path: "/user/loja" },
  { label: "Recompensas", icon: faGift,      path: "/user/recompensas" },
  { label: "Perfil",      icon: faUser,      path: "/user/perfil" },
];

export default function UserNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  const isActive = (path: string) =>
    path === "/user" ? pathname === "/user" : pathname.startsWith(path);

  return (
    <>
      {/* Desktop — header fixo no topo */}
      <header className="hidden lg:flex fixed top-0 left-0 w-full h-16 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 items-center justify-between px-10 z-50">
        <Link href="/user">
          <Image src="/images/gamebank-logo.png" alt="GameBank" width={100} height={100} className="w-12" />
        </Link>

        <nav className="flex items-center gap-8">
          {NAV_TABS.slice(1).map((tab) => (
            <Link
              key={tab.path}
              href={tab.path}
              className={`font-jaro text-sm transition-colors ${
                isActive(tab.path) ? "text-green-400" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Button1 size="md" color="green" handle={() => router.push("/user/new-session")}>
            Criar Sala
          </Button1>
        </div>
      </header>

      {/* Mobile — bottom nav fixo */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800">
        <ul className="grid grid-cols-5 w-full">
          {NAV_TABS.map((tab) => (
            <li
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center justify-center py-3 gap-0.5 cursor-pointer transition-colors select-none active:scale-95 ${
                isActive(tab.path) ? "text-green-400" : "text-zinc-500"
              }`}
            >
              {tab.path === "/user/perfil" && user ? (
                <UserAvatar
                  avatarUrl={user.avatarUrl}
                  avatarUpdatedAt={user.avatarUpdatedAt}
                  nome={user.nome}
                  size="sm"
                  ring={isActive("/user/perfil")}
                />
              ) : (
                <FontAwesomeIcon
                  icon={tab.icon}
                  className={`text-xl ${isActive(tab.path) ? "drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" : ""}`}
                />
              )}
              <span className="text-[10px] font-inconsolata font-medium">{tab.label}</span>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
