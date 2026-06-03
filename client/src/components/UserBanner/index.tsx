"use client";

import { resolveBannerBackground } from "@/constants/banners";
import { resolveSprite } from "@/constants/sprites";

type UserBannerProps = {
  banner?: string | null;
  spriteId?: string | null;
  imageUrl?: string | null;
  className?: string;
};

export default function UserBanner({ banner, spriteId, imageUrl, className = "" }: UserBannerProps) {
  const value = imageUrl ?? banner ?? null;
  const bg = resolveBannerBackground(value);

  const sprite = resolveSprite(spriteId);
  const SpriteIcon = sprite?.icon;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0" style={bg.style} />
      {SpriteIcon && (
        <div className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg bg-zinc-900/70 backdrop-blur-sm border border-white/10 grid place-items-center text-white shadow-sm">
          <SpriteIcon size={15} />
        </div>
      )}
    </div>
  );
}
