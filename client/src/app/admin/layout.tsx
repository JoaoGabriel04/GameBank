"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Users, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

const navItems = [
  { href: "/admin/loja", label: "Loja", icon: ShoppingBag },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 flex items-center px-4 gap-4 shrink-0 z-40 bg-zinc-950">
        <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Voltar ao site</span>
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <span className="font-jaro text-lg text-white">GameBank</span>
          <span className="text-[10px] font-inconsolata bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full uppercase tracking-widest">
            Admin
          </span>
        </div>
        {user && (
          <span className="ml-auto text-xs font-inconsolata text-zinc-500 hidden sm:block">
            {user.nome}
          </span>
        )}
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden md:flex w-52 border-r border-zinc-800 flex-col p-4 gap-1 shrink-0">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-inconsolata transition-colors ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950 flex z-40">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-[10px] font-inconsolata transition-colors ${
                active ? "text-white" : "text-zinc-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
