"use client";

import React, { useState } from "react";
import {
  Gauge,
  Scroll,
  Server,
  Users,
  Store,
  Target,
  Dice5,
  Image,
  DollarSign,
  ArrowRight,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { useAuthStore } from "@/stores/authStore";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: boolean;
  live?: boolean;
}

interface NavSection {
  group: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    group: "Visão geral",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/admin", icon: Gauge },
      { id: "audit", label: "Auditoria", href: "/admin/audit", icon: Scroll },
    ],
  },
  {
    group: "Jogo ao vivo",
    items: [
      {
        id: "sessions",
        label: "Sessões",
        href: "/admin/sessoes",
        icon: Server,
        badge: true,
        live: true,
      },
    ],
  },
  {
    group: "Comunidade",
    items: [
      {
        id: "users",
        label: "Usuários",
        href: "/admin/usuarios",
        icon: Users,
        badge: true,
      },
    ],
  },
  {
    group: "Conteúdo",
    items: [
      { id: "shop", label: "Loja", href: "/admin/loja", icon: Store },
      { id: "missions", label: "Missões", href: "/admin/recompensas", icon: Target },
      { id: "cards", label: "Cartas", href: "/admin/cartas", icon: Dice5 },
      {
        id: "cosmetics",
        label: "Cosméticos",
        href: "/admin/cosmeticos",
        icon: Image,
      },
    ],
  },
  {
    group: "Sistema",
    items: [
      {
        id: "economy",
        label: "Economia",
        href: "/admin/economia",
        icon: DollarSign,
      },
    ],
  },
];

const ADMIN_USER = { nome: "João Gabriel", avatarUrl: "/images/admin.avif", avatarUpdatedAt: new Date().toISOString() };

interface AdminNavProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminNav({ open, onClose }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const W = collapsed ? 72 : 240;

  // Mock badge count - replace with real data
  const badgeCount = (id: string) => {
    const counts: Record<string, number> = {
      sessions: 3,
      users: 247,
    };
    return counts[id] || 0;
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/60 z-40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-zinc-950 border-r border-zinc-800 z-50 transition-all duration-200 lg:!translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: W }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div
            className={`flex items-center gap-3 px-4 h-16 border-b border-zinc-800 ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 grid place-items-center shrink-0 shadow-[0_0_20px_-4px] shadow-cyan-500/60">
              <Server size={20} className="text-zinc-950" strokeWidth={2.4} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-jaro text-sm text-white leading-none">GameBank</p>
                <p className="font-mono text-[9px] text-cyan-400 uppercase tracking-[0.2em] mt-1">
                  Console Admin
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
            {NAV_SECTIONS.map((section) => (
              <div key={section.group}>
                {!collapsed && (
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-600 px-2.5 mb-1.5">
                    {section.group}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    const badge = item.badge ? badgeCount(item.id) : null;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg font-mono text-sm transition-all cursor-pointer relative ${
                          collapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-transparent"
                        }`}
                      >
                        <span className="relative shrink-0">
                          <Icon size={17} />
                          {item.live && badge && badge > 0 && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
                          )}
                        </span>
                        {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                        {!collapsed && badge != null && (
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md ${
                              item.live
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-zinc-800 text-zinc-500"
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-zinc-800 p-2.5 space-y-1">
            <a
              href="/"
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg font-mono text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <ArrowRight size={15} />
              {!collapsed && "Voltar ao site"}
            </a>
            <div className={`flex items-center gap-2.5 px-2.5 py-2 ${collapsed ? "justify-center" : ""}`}>
              <UserAvatar nome={ADMIN_USER.nome} avatarUrl={ADMIN_USER.avatarUrl} avatarUpdatedAt={ADMIN_USER.avatarUpdatedAt} size="md" />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-zinc-200 truncate leading-none">
                    {ADMIN_USER.nome}
                  </p>
                  <p className="font-mono text-[9px] text-violet-400 mt-1">
                    administrador
                  </p>
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={handleLogout}
                  className="text-zinc-600 hover:text-rose-400 cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Collapse toggle (desktop) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:grid absolute -right-3 top-20 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 place-items-center text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/50 cursor-pointer z-10"
          >
            {collapsed ? (
              <ChevronRight size={13} />
            ) : (
              <ChevronLeft size={13} />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
