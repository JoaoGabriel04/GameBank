"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

/* ─── Panel (base dark card) ─── */
export function Panel({
  className = "",
  children,
  flush = false,
}: {
  className?: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      className={`bg-zinc-900/70 border border-zinc-800 rounded-xl ${
        flush ? "" : "p-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── PanelHead ─── */
export function PanelHead({
  title,
  icon: Icon,
  right,
  sub,
}: {
  title: string;
  icon?: LucideIcon;
  right?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {Icon && <span className="text-cyan-400 shrink-0"><Icon size={16} /></span>}
        <div className="min-w-0">
          <h3 className="font-mono text-sm text-zinc-200 font-semibold truncate tracking-tight">
            {title}
          </h3>
          {sub && (
            <p className="font-mono text-[10px] text-zinc-500 truncate">{sub}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ─── Avatar ─── */
export function Avatar({
  user,
  size = 36,
}: {
  user: { nome?: string; avatar?: { initial: string; hue: number } };
  size?: number;
}) {
  const a = user.avatar || { initial: (user.nome || "?").charAt(0), hue: 200 };
  return (
    <span
      className="rounded-full grid place-items-center font-jaro text-white shrink-0 ring-1 ring-white/10"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${a.hue} 65% 45%), hsl(${
          (a.hue + 40) % 360
        } 70% 35%))`,
      }}
    >
      {a.initial}
    </span>
  );
}

/* ─── Chip / Badge ─── */
export function Chip({
  tone = "zinc",
  children,
  className = "",
  dot = false,
}: {
  tone?: "cyan" | "emerald" | "amber" | "rose" | "violet" | "sky" | "zinc";
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const tones = {
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/30",
    sky: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    zinc: "bg-zinc-700/30 text-zinc-400 border-zinc-600/40",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase tracking-wider whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ─── Delta (% change indicator) ─── */
export function Delta({
  value,
  Icon,
}: {
  value: number;
  Icon: React.ComponentType<{ size: number }>;
}) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold ${
        up ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      <Icon size={12} />
      {Math.abs(value)}%
    </span>
  );
}

/* ─── LiveDot ─── */
export function LiveDot({
  tone = "emerald",
}: {
  tone?: "emerald" | "amber" | "zinc";
}) {
  const colors = {
    emerald: "#34d399",
    amber: "#fbbf24",
    zinc: "#71717a",
  };
  return (
    <span className="relative inline-flex w-2 h-2">
      <span
        className="absolute inset-0 rounded-full animate-ping"
        style={{ background: colors[tone], opacity: 0.7 }}
      />
      <span
        className="relative w-2 h-2 rounded-full"
        style={{ background: colors[tone] }}
      />
    </span>
  );
}

/* ─── Clock ─── */
export function Clock() {
  const [t, setT] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs text-zinc-400 tabular-nums">
      {t.toLocaleTimeString("pt-BR")}
    </span>
  );
}

/* ─── Drawer (right slide-over) ─── */
export function Drawer({
  open,
  onClose,
  children,
  width = 480,
  title,
  icon: Icon,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  title?: string;
  icon?: React.ComponentType<{ size: number }>;
}) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className="absolute top-0 right-0 h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl transition-transform overflow-y-auto"
        style={{
          width: `min(100%, ${width}px)`,
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
            <div className="flex items-center gap-2">
              {Icon && <span className="text-cyan-400"><Icon size={18} /></span>}
              <h2 className="font-jaro text-lg text-white whitespace-nowrap">
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white cursor-pointer p-1"
            >
              <span className="w-5 h-5 flex items-center justify-center">✕</span>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ─── Modal (centered) ─── */
export function Modal({
  open,
  onClose,
  children,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}
