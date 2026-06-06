"use client";

import { useState } from "react";

type DiamondIconProps = {
  size?: number;
  className?: string;
};

export default function DiamondIcon({ size = 14, className = "" }: DiamondIconProps) {
  const src = size > 24 ? "/images/diamond-128.png" : "/images/diamond-64.png";
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
