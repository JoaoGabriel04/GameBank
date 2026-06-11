"use client";

/**
 * UserUI.tsx — Primitivos visuais das páginas do usuário
 * Salve em: src/components/user/UserUI.tsx
 *
 * Contém: Progress, Chip, Panel, PanelHead, Segmented, UBtn, UModal, LiveDot
 * Acento verde (--green-400/#4ade80) consistente com o design do site.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { backdrop, modalBox } from "@/lib/animations";

/* --- Progress bar --- */
export function Progress({
  value,
  max = 100,
  tone = "green",
  height = 6,
  className = "",
}: {
  value: number;
  max?: number;
  tone?: "green" | "emerald" | "cyan" | "amber" | "violet" | "rose" | "teal" | "sky";
  height?: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const grad: Record<string, string> = {
    green:   "linear-gradient(90deg,#16a34a,#4ade80)",
    emerald: "linear-gradient(90deg,#059669,#34d399)",
    cyan:    "linear-gradient(90deg,#0891b2,#22d3ee)",
    amber:   "linear-gradient(90deg,#d97706,#fbbf24)",
    violet:  "linear-gradient(90deg,#7c3aed,#a78bfa)",
    rose:    "linear-gradient(90deg,#e11d48,#fb7185)",
    teal:    "linear-gradient(90deg,#0f766e,#2dd4bf)",
    sky:     "linear-gradient(90deg,#8ecae6,#3a86ff)"
  };
  return (
    <div
      className={`w-full rounded-full bg-zinc-800 overflow-hidden ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: grad[tone] || grad.green }}
      />
    </div>
  );
}

/* --- Chip / badge --- */
type ChipTone = "green" | "emerald" | "amber" | "rose" | "cyan" | "violet" | "sky" | "zinc" | "teal";

const CHIP_TONES: Record<ChipTone, string> = {
  green:   "bg-green-500/10 text-green-300 border-green-500/30",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  amber:   "bg-amber-500/10 text-amber-300 border-amber-500/30",
  rose:    "bg-rose-500/10 text-rose-300 border-rose-500/30",
  cyan:    "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  violet:  "bg-violet-500/10 text-violet-300 border-violet-500/30",
  sky:     "bg-sky-500/10 text-sky-300 border-sky-500/30",
  zinc:    "bg-zinc-700/30 text-zinc-400 border-zinc-600/40",
  teal:    "bg-teal-500/10 text-teal-300 border-teal-500/30",
};

export function Chip({
  tone = "zinc",
  children,
  dot = false,
  className = "",
}: {
  tone?: ChipTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-inconsolata text-[10px] uppercase tracking-wider whitespace-nowrap ${CHIP_TONES[tone]} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      {children}
    </span>
  );
}

/* --- Panel --- */
export function Panel({
  children,
  className = "",
  flush = false,
}: {
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 rounded-2xl ${flush ? "" : "p-4"} ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
      <div className="min-w-0 flex-1">
        <h3 className="font-jaro text-sm text-zinc-100 truncate">{title}</h3>
        {sub && <p className="font-inconsolata text-[10px] text-zinc-500 truncate">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* --- Segmented control --- */
export function Segmented({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: (string | { value: string; label: string })[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex bg-zinc-900 border border-zinc-800 rounded-xl p-0.5 gap-0.5 flex-wrap">
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lbl = typeof o === "string" ? o : o.label;
        const active = val === value;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={`px-3 ${size === "sm" ? "py-1 text-[11px]" : "py-1.5 text-xs"} rounded-lg font-inconsolata transition-all cursor-pointer whitespace-nowrap border ${
              active
                ? "bg-green-500/15 text-green-300 border-green-500/30"
                : "text-zinc-500 hover:text-zinc-300 border-transparent"
            }`}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

/* --- Button --- */
type BtnVariant = "primary" | "ghost" | "subtle" | "danger";

export function UBtn({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  className = "",
  disabled,
  type = "button",
  icon: Icon,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const sz = size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-5 py-3 text-sm font-semibold" : "px-3.5 py-2 text-sm";
  const styles: Record<BtnVariant, string> = {
    primary: "bg-green-500 text-zinc-950 font-semibold hover:bg-green-400 shadow-[0_0_20px_-6px_rgba(74,222,128,0.6)]",
    ghost:   "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white",
    subtle:  "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white",
    danger:  "border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 font-inconsolata rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${sz} ${styles[variant]} ${className}`}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 16} />}
      {children}
    </button>
  );
}

/* --- Modal (centered overlay) --- */
export function UModal({
  open,
  onClose,
  children,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] grid place-items-center p-4">
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            variants={modalBox}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{ maxWidth: width }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* --- Live dot --- */
export function LiveDot({ tone = "green" }: { tone?: "green" | "amber" | "zinc" }) {
  const c = { green: "#4ade80", amber: "#fbbf24", zinc: "#71717a" }[tone];
  return (
    <span className="relative inline-flex w-2 h-2 shrink-0">
      <span
        className="absolute inset-0 rounded-full animate-ping"
        style={{ background: c, opacity: 0.7 }}
      />
      <span className="relative w-2 h-2 rounded-full" style={{ background: c }} />
    </span>
  );
}

/* --- XP helpers --- */
export const xpForLevel = (level: number) =>
  Math.floor(200 * Math.pow(1.17, level - 1));

export const totalXpForLevels = (level: number) => {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpForLevel(i);
  return total;
};
