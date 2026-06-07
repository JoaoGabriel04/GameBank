/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

type CoinIconProps = {
  size?: number;
  className?: string;
};

export default function CoinIcon({ size = 14, className = "" }: CoinIconProps) {
  const src = size > 24 ? "/images/coin-128.png" : "/images/coin-64.png";
  const [, setError] = useState(false);

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={className}
      onError={() => setError(true)}
    />
  );
}
