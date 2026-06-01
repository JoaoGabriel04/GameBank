"use client";
import { resolveBadge } from "@/constants/badges";

type BadgeVariant = "micro" | "small" | "medium" | "large" | "showcase";

type UserBadgeProps = {
  badge?: string | null;
  variant?: BadgeVariant;
  showLabel?: boolean;
  className?: string;
};

const VARIANT_CONFIG: Record<BadgeVariant, { container: string; size: string; textSize: string }> = {
  micro: {
    container: "",
    size: "w-4 h-4",
    textSize: "text-[10px]",
  },
  small: {
    container: "",
    size: "w-6 h-6",
    textSize: "text-xs",
  },
  medium: {
    container: "flex flex-col items-center gap-1",
    size: "w-8 h-8",
    textSize: "text-sm",
  },
  large: {
    container: "flex flex-col items-center gap-2",
    size: "w-12 h-12",
    textSize: "text-2xl",
  },
  showcase: {
    container: "flex flex-col items-center gap-2 p-4",
    size: "w-16 h-16",
    textSize: "text-4xl",
  },
};

export default function UserBadge({
  badge,
  variant = "micro",
  showLabel = false,
  className = "",
}: UserBadgeProps) {
  const preset = resolveBadge(badge);
  if (!preset) return null;

  const config = VARIANT_CONFIG[variant];
  const isMicro = variant === "micro";

  return (
    <div className={config.container || "inline-flex"}>
      <span
        className={`inline-flex items-center justify-center rounded-full ${config.size} ${config.textSize} ${preset.bgColor} ${className}`}
        title={preset.label}
      >
        {preset.emoji}
      </span>
      {showLabel && !isMicro && (
        <span className="text-[10px] text-zinc-400 text-center max-w-[70px] leading-tight">
          {preset.label}
        </span>
      )}
    </div>
  );
}
