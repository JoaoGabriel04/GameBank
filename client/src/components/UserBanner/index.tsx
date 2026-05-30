"use client";

import { resolveBanner } from "@/constants/banners";

type UserBannerProps = {
  banner?: string | null;
  className?: string;
};

export default function UserBanner({ banner, className = "" }: UserBannerProps) {
  const preset = resolveBanner(banner);
  const gradient = preset
    ? `bg-gradient-to-r ${preset.gradient}`
    : "bg-gradient-to-r from-zinc-700 to-zinc-800";

  return <div className={`${gradient} ${className}`} />;
}
