"use client";

import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStore,
  faGift,
  faHouse,
  faCircleInfo,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { useAuthStore } from "@/stores/authStore";
import UserAvatar from "@/components/UserAvatar";

const siteTabs = [
  { label: "Loja", icon: faStore, path: "/loja" },
  { label: "Recompensas", icon: faGift, path: "/recompensas" },
  { label: "Início", icon: faHouse, path: "/" },
  { label: "Saiba Mais", icon: faCircleInfo, path: "/saibamais" },
];

export default function SiteBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  function handleNav(path: string) {
    if (user) {
      router.push(path);
    } else {
      router.push(`/login?redirect=${encodeURIComponent(path)}`);
    }
  }

  function handlePerfil() {
    if (user) {
      router.push("/perfil");
    } else {
      router.push("/login");
    }
  }

  const isActive = (tabPath: string) => pathname === tabPath;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800">
      <ul className="w-full grid grid-cols-5">
        {siteTabs.map((tab) => (
          <li
            key={tab.label}
            onClick={() => handleNav(tab.path)}
            className={`flex flex-col items-center justify-center py-2.5 gap-0.5 cursor-pointer transition-colors select-none active:scale-95 ${
              isActive(tab.path)
                ? "text-green-400"
                : "text-zinc-500"
            }`}
          >
            <FontAwesomeIcon
              icon={tab.icon}
              className={`text-xl ${isActive(tab.path) ? "drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" : ""}`}
            />
            <span className="text-[10px] font-inconsolata font-medium">{tab.label}</span>
          </li>
        ))}

        <li
          onClick={handlePerfil}
          className={`flex flex-col items-center justify-center py-2.5 gap-0.5 cursor-pointer transition-colors select-none active:scale-95 ${
            isActive("/sessions") || isActive("/login")
              ? "text-green-400"
              : "text-zinc-500"
          }`}
        >
          {user ? (
            <UserAvatar
              avatarUrl={user.avatarUrl}
              avatarUpdatedAt={user.avatarUpdatedAt}
              nome={user.nome}
              size="sm"
              ring={isActive("/perfil")}
              frame={user.frame}
              frameType={user.frameType}
              frameAnimated={user.frameAnimated}
              frameScale={user.frameScale ?? 136}
            />
          ) : (
            <FontAwesomeIcon
              icon={faUser}
              className={`text-xl ${isActive("/login") ? "drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" : ""}`}
            />
          )}
          <span className="text-[10px] font-inconsolata font-medium">Perfil</span>
        </li>
      </ul>
    </nav>
  );
}
