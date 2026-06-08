"use client";

/**
 * AdminUI.tsx — Primitivos visuais do painel admin
 * Salve em: src/components/admin/AdminUI.tsx
 *
 * Contém: Panel, PanelHead, Chip, Toggle, Progress, Segmented,
 *         Btn, Field, AdminInput, AdminTextarea, AdminSelect,
 *         Avatar, Drawer, Modal, LiveDot
 */

import React, { useState, useEffect } from "react";
import {
  LucideIcon,
  ArrowUp,
  ArrowDown,
  Check,
  X as XIcon,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import type { AdminUser } from "@/services/api/admin";

/* ─── Types ─── */
export type ChipTone =
  | "cyan" | "emerald" | "amber" | "rose" | "violet" | "sky" | "zinc" | "teal";

/* ─── Chip ─── */
const CHIP_TONES: Record<ChipTone, string> = {
  cyan:    "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  amber:   "bg-amber-500/10 text-amber-300 border-amber-500/30",
  rose:    "bg-rose-500/10 text-rose-300 border-rose-500/30",
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

/* ─── Toggle switch ─── */
export function Toggle({
  on,
  onChange,
  size = "md",
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? 32 : 40;
  const h = size === "sm" ? 18 : 22;
  const kw = size === "sm" ? 14 : 18;
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="cursor-pointer shrink-0 rounded-full transition-colors"
      style={{
        width: w,
        height: h,
        background: on ? "#22d3ee" : "#3f3f46",
        position: "relative",
      }}
      aria-checked={on}
      role="switch"
    >
      <span
        className="absolute top-0.5 rounded-full bg-white transition-all"
        style={{
          width: kw,
          height: kw,
          left: on ? w - kw - 2 : 2,
        }}
      />
    </button>
  );
}

/* ─── Progress bar ─── */
export function Progress({
  value,
  max = 100,
  tone = "cyan",
  height = 6,
  className = "",
}: {
  value: number;
  max?: number;
  tone?: "cyan" | "emerald" | "amber" | "violet" | "rose" | "green";
  height?: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const grad: Record<string, string> = {
    cyan:    "linear-gradient(90deg,#0891b2,#22d3ee)",
    emerald: "linear-gradient(90deg,#059669,#34d399)",
    amber:   "linear-gradient(90deg,#d97706,#fbbf24)",
    violet:  "linear-gradient(90deg,#7c3aed,#a78bfa)",
    rose:    "linear-gradient(90deg,#e11d48,#fb7185)",
    green:   "linear-gradient(90deg,#16a34a,#4ade80)",
  };
  return (
    <div
      className={`w-full rounded-full bg-zinc-800 overflow-hidden ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: grad[tone] || grad.cyan }}
      />
    </div>
  );
}

/* ─── Panel ─── */
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
      className={`bg-zinc-900/70 border border-zinc-800 rounded-xl ${flush ? "" : "p-4"} ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  icon: Icon,
  sub,
  right,
}: {
  title: string;
  icon?: LucideIcon;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {Icon && <span className="text-cyan-400 shrink-0"><Icon size={15} /></span>}
        <div className="min-w-0">
          <h3 className="font-inconsolata text-sm text-zinc-200 font-semibold truncate tracking-tight">
            {title}
          </h3>
          {sub && (
            <p className="font-inconsolata text-[10px] text-zinc-500 truncate">{sub}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ─── Segmented control ─── */
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
                ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
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

/* ─── Button ─── */
type BtnVariant = "primary" | "ghost" | "subtle" | "danger";
export function Btn({
  children,
  onClick,
  variant = "ghost",
  icon: Icon,
  size = "md",
  className = "",
  disabled,
  type = "button",
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center gap-2 font-inconsolata rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";
  const sz = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  const styles: Record<BtnVariant, string> = {
    primary:
      "bg-cyan-500 text-zinc-950 font-semibold hover:bg-cyan-400 shadow-[0_0_20px_-6px_rgba(34,211,238,0.6)]",
    ghost:
      "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white",
    subtle: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white",
    danger:
      "border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sz} ${styles[variant]} ${className}`}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
}

/* ─── Form field wrapper ─── */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5 block">
        {label}
      </span>
      {children}
      {hint && (
        <span className="font-inconsolata text-[10px] text-zinc-600 mt-1 block">
          {hint}
        </span>
      )}
    </label>
  );
}

const inputCls =
  "w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 font-inconsolata text-sm text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors placeholder:text-zinc-600";

export function AdminInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function AdminTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={`${inputCls} resize-none ${props.className ?? ""}`}
    />
  );
}

export function AdminSelect({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  children: React.ReactNode;
}) {
  return (
    <select {...props} className={`${inputCls} cursor-pointer ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

/* ─── User avatar wrapper (uses real UserAvatar component) ─── */
export function AdminAvatar({
  user,
  size = "md",
}: {
  user: Pick<AdminUser, "avatarUrl" | "avatarUpdatedAt" | "nome"> & { frame?: string | null; frameType?: string | null; frameAnimated?: boolean; frameScale?: number };
  size?: "sm" | "md" | "lg";
}) {
  return (
    <UserAvatar
      avatarUrl={user.avatarUrl}
      avatarUpdatedAt={user.avatarUpdatedAt}
      nome={user.nome}
      size={size}
      frame={user.frame}
      frameType={user.frameType as "image" | "gradient" | null | undefined}
      frameAnimated={user.frameAnimated}
      frameScale={user.frameScale ?? 136}
    />
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
  icon?: LucideIcon;
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
          transitionDuration: "200ms",
        }}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
            <div className="flex items-center gap-2">
              {Icon && (
                <span className="text-cyan-400">
                  <Icon size={18} />
                </span>
              )}
              <h2 className="font-jaro text-lg text-white whitespace-nowrap">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <XIcon size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ─── Modal (centered overlay) ─── */
export function AdminModal({
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

/* ─── Live dot ─── */
export function LiveDot({ tone = "emerald" }: { tone?: "emerald" | "amber" | "zinc" }) {
  const c = { emerald: "#34d399", amber: "#fbbf24", zinc: "#71717a" }[tone];
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

/* ─── Delta indicator ─── */
export function Delta({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-inconsolata text-xs font-semibold ${
        up ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      <Icon size={12} />
      {Math.abs(value)}%
    </span>
  );
}

/* ─── Confirm delete inline button ─── */
export function ConfirmDelete({
  onConfirm,
  icon: Icon,
}: {
  onConfirm: () => void;
  icon: LucideIcon;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming)
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer transition-colors"
      >
        <Icon size={14} />
      </button>
    );
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => { setConfirming(false); onConfirm(); }}
        className="text-rose-400 hover:text-rose-300 cursor-pointer p-1"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-zinc-500 hover:text-white cursor-pointer p-1"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}

/* ─── Mock avatar (gradient with initial) ─── */
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

/* ─── Live clock ─── */
export function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-inconsolata text-xs text-zinc-400 tabular-nums">
      {t.toLocaleTimeString("pt-BR")}
    </span>
  );
}
