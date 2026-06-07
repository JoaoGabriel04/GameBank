/* eslint-disable @next/next/no-img-element */
"use client";

type BadgeVariant = "micro" | "small" | "medium" | "large" | "showcase";

type UserBadgeProps = {
  badge?: string | null;
  imageUrl?: string | null;
  variant?: BadgeVariant;
  showLabel?: boolean;
  className?: string;
};

const VARIANT_CONFIG: Record<BadgeVariant, { className: string; labelClass: string }> = {
  micro:  { className: "w-4 h-4", labelClass: "text-[10px]" },
  small:  { className: "w-6 h-6", labelClass: "text-xs" },
  medium: { className: "w-8 h-8", labelClass: "text-sm" },
  large:  { className: "w-12 h-12", labelClass: "text-2xl" },
  showcase: { className: "w-16 h-16", labelClass: "text-4xl" },
};

export default function UserBadge({
  badge,
  imageUrl,
  variant = "micro",
  showLabel = false,
  className = "",
}: UserBadgeProps) {
  if (!badge && !imageUrl) return null;

  const config = VARIANT_CONFIG[variant];
  const isMicro = variant === "micro";

  return (
    <div className="inline-flex flex-col items-center gap-1">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          width={parseInt(config.className.match(/\d+/)?.[0] ?? "8") * 4}
          height={parseInt(config.className.match(/\d+/)?.[0] ?? "8") * 4}
          draggable={false}
          className={`${config.className} object-contain ${className}`}
        />
      ) : (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-zinc-700 text-zinc-300 ${config.className} ${config.labelClass} ${className}`}
        >
          ?
        </span>
      )}
      {showLabel && !isMicro && badge && (
        <span className="text-[10px] text-zinc-400 text-center max-w-[70px] leading-tight">
          {badge}
        </span>
      )}
    </div>
  );
}
