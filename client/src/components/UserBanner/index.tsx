"use client";

import { resolveBannerBackground } from "@/constants/banners";

type UserBannerProps = {
  banner?: string | null;
  imageUrl?: string | null;
  animated?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export default function UserBanner({ banner, imageUrl, animated = false, className = "", style }: UserBannerProps) {
  const value = imageUrl ?? banner ?? null;
  const bg = resolveBannerBackground(value);
  const isGradient = !imageUrl && !value?.startsWith("http");

  const callerPositions = /\b(absolute|fixed|sticky)\b/.test(className);
  const wrapperClass = `${callerPositions ? "" : "relative"} overflow-hidden ${className}`.trim();

  const animatedStyle: React.CSSProperties =
    animated && isGradient
      ? { backgroundSize: "300% 300%", animation: "gb-aurora 6s ease infinite" }
      : {};

  return (
    <div className={wrapperClass} style={style}>
      <div
        className="absolute inset-0"
        style={{ ...bg.style, ...animatedStyle }}
      />
    </div>
  );
}
