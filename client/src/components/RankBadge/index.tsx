'use client';

import Image from "next/image";
import { getTrophyAssetName, getTrophyLabel } from "@/utils/trophies";

type Props = {
  trophies: number;
  size?: number;
  className?: string;
};

export default function RankBadge({ trophies, size = 32, className = "" }: Props) {
  const asset = getTrophyAssetName(trophies);
  const label = getTrophyLabel(trophies);
  return (
    <Image
      src={`/ranks/${asset}.png`}
      alt={label}
      width={size}
      height={size}
      className={`object-contain shrink-0 ${className}`}
    />
  );
}
