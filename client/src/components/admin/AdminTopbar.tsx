"use client";

import { Menu, Search, Bell } from "lucide-react";
import { Clock, Avatar, Chip, LiveDot } from "./AdminBase";

interface AdminTopbarProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

const ADMIN_USER = { nome: "João Gabriel", avatar: { initial: "J", hue: 200 } };

export default function AdminTopbar({
  title,
  subtitle,
  onMenuClick,
}: AdminTopbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800 h-16 flex items-center gap-3 px-4 lg:px-6">
      {/* Menu Button (mobile) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-zinc-400 hover:text-white cursor-pointer"
      >
        <Menu size={20} />
      </button>

      {/* Title */}
      <div className="min-w-0 flex-1">
        <h1 className="font-jaro text-lg lg:text-xl text-white whitespace-nowrap">
          {title}
        </h1>
        {subtitle && (
          <p className="font-mono text-[11px] text-zinc-500 truncate hidden sm:block">
            {subtitle}
          </p>
        )}
      </div>

      {/* Global Search */}
      <button className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600 cursor-pointer transition-colors w-56">
        <Search size={14} />
        <span className="font-mono text-xs flex-1 text-left">Buscar…</span>
        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
          ⌘K
        </span>
      </button>

      {/* Status Bar (desktop) */}
      <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900">
        <LiveDot />
        <Clock />
      </div>

      {/* PROD Chip (desktop) */}
      <Chip tone="emerald" className="hidden xl:inline-flex">
        PROD
      </Chip>

      {/* Notifications */}
      <button className="relative text-zinc-400 hover:text-white cursor-pointer p-1.5">
        <Bell size={18} />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-400" />
      </button>

      {/* Avatar */}
      <Avatar user={ADMIN_USER} size={32} />
    </header>
  );
}
