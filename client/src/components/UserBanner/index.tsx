"use client";

import { resolveBannerBackground } from "@/constants/banners";

type UserBannerProps = {
  banner?: string | null;
  imageUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
};

export default function UserBanner({ banner, imageUrl, className = "", style }: UserBannerProps) {
  const value = imageUrl ?? banner ?? null;
  const bg = resolveBannerBackground(value);

  const callerPositions = /\b(absolute|fixed|sticky)\b/.test(className);
  const wrapperClass = `${callerPositions ? "" : "relative"} overflow-hidden ${className}`.trim();

  return (
    <div className={wrapperClass} style={style}>
      <div className="absolute inset-0" style={bg.style} />
    </div>
  );
}
