'use client';

import Image from "next/image";
import { getTrophyAssetName, getTrophyLabel } from "@/utils/trophies";

type Props = {
  trophies: number;
  size?: number;
  showLabel?: boolean;
  className?: string;
};

export default function TrophyBadge({ trophies, size = 40, showLabel = false, className = "" }: Props) {
  const asset = getTrophyAssetName(trophies);
  const label = getTrophyLabel(trophies);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Image
        src={`/ranks/${asset}.png`}
        alt={label}
        width={size}
        height={size}
        className="object-contain"
      />
      {showLabel && (
        <span className="font-inconsolata text-xs text-zinc-400">{label}</span>
      )}
    </div>
  );
}
