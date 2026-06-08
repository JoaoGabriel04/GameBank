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

  let innerStyle: React.CSSProperties = bg.style;
  if (animated && isGradient) {
    // background shorthand resets background-size to auto.
    // Use backgroundImage separately so backgroundSize:300% 300% is not overridden.
    const gradientValue = (bg.style.background ?? bg.style.backgroundImage) as string;
    innerStyle = {
      backgroundImage: gradientValue,
      backgroundSize: "300% 300%",
      backgroundPosition: "0% 50%",
    };
  }

  return (
    <div className={wrapperClass} style={style}>
      <div
        className={`absolute inset-0${animated && isGradient ? " gb-banner-animated" : ""}`}
        style={innerStyle}
      />
    </div>
  );
}
