/* eslint-disable @next/next/no-img-element */
"use client";

import { resolvePreset } from "@/constants/avatars";

type UserAvatarProps = {
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | null;
  nome?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
};

const sizeMap = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-16 h-16 text-2xl",
  xl: "w-28 h-28 text-5xl",
};

function withCacheBust(url: string, avatarUpdatedAt?: string | null) {
  if (!avatarUpdatedAt || url.startsWith("blob:") || url.startsWith("preset:")) return url;
  const v = new Date(avatarUpdatedAt).getTime();
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${v}`;
}

export default function UserAvatar({
  avatarUrl,
  avatarUpdatedAt,
  nome = "?",
  size = "md",
  className = "",
  ring = false,
}: UserAvatarProps) {
  const dim = sizeMap[size];
  const ringClass = ring ? "ring-2 ring-green-500/60 ring-offset-2 ring-offset-zinc-950" : "";

  if (
    avatarUrl &&
    (avatarUrl.startsWith("http://") ||
      avatarUrl.startsWith("https://") ||
      avatarUrl.startsWith("blob:") ||
      avatarUrl.startsWith("data:image"))
  ) {
    return (
      <img
        src={withCacheBust(avatarUrl, avatarUpdatedAt)}
        alt={nome}
        className={`${dim} rounded-full object-cover shrink-0 ${ringClass} ${className}`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  if (avatarUrl?.startsWith("preset:")) {
    const preset = resolvePreset(avatarUrl.replace("preset:", ""));
    if (preset) {
      return (
        <div
          className={`${dim} rounded-full bg-gradient-to-br ${preset.gradient} flex items-center justify-center shrink-0 shadow-lg ${ringClass} ${className}`}
          title={preset.label}
        >
          <span className="select-none leading-none">{preset.glyph}</span>
        </div>
      );
    }
  }

  const initial = (nome.trim() || "?").charAt(0).toUpperCase();
  return (
    <div
      className={`${dim} rounded-full bg-zinc-700 flex items-center justify-center shrink-0 font-jaro text-zinc-100 ${ringClass} ${className}`}
    >
      {initial}
    </div>
  );
}
