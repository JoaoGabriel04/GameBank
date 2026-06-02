"use client";

import { resolveBanner } from "@/constants/banners";
import { resolveSprite } from "@/constants/sprites";

type UserBannerProps = {
  banner?: string | null;
  spriteId?: string | null;
  className?: string;
};

export default function UserBanner({ banner, spriteId, className = "" }: UserBannerProps) {
  let bgClass = "bg-gradient-to-r from-zinc-600 to-zinc-800";
  let style: React.CSSProperties | undefined;

  if (banner?.startsWith("preset:")) {
    const preset = resolveBanner(banner);
    bgClass = preset
      ? `bg-gradient-to-r ${preset.gradient}`
      : "bg-gradient-to-r from-zinc-600 to-zinc-800";
  } else if (
    banner?.startsWith("linear-gradient") ||
    banner?.startsWith("radial-gradient") ||
    banner?.startsWith("#") ||
    banner?.startsWith("rgb") ||
    banner?.startsWith("hsl")
  ) {
    style = { background: banner };
  }

  const sprite = resolveSprite(spriteId);
  const SpriteIcon = sprite?.icon;

  return (
    <div className={className}>
      <div className={`absolute inset-0 overflow-hidden ${bgClass}`} style={style}>
        {SpriteIcon && (
          <div className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg bg-zinc-900/70 backdrop-blur-sm border border-white/10 grid place-items-center text-white shadow-sm">
            <SpriteIcon size={15} />
          </div>
        )}
      </div>
    </div>
  );
}
