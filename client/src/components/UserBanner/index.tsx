"use client";

import { useRef, useEffect } from "react";
import { animateGradientLoop } from "@/lib/animations";
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
  const animRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animRef.current) return;
    const tween = animateGradientLoop(animRef.current, 3);
    return () => { tween.kill(); };
  }, []);

  const callerPositions = /\b(absolute|fixed|sticky)\b/.test(className);
  const wrapperClass = `${callerPositions ? "" : "relative"} overflow-hidden ${className}`.trim();

  if (animated && isGradient) {
    const gradientValue = (bg.style.background ?? bg.style.backgroundImage) as string;
    return (
      <div className={wrapperClass} style={style}>
        <div
          ref={animRef}
          className="absolute inset-0"
          style={{ backgroundImage: gradientValue, backgroundSize: "300% 300%", backgroundPosition: "0% 50%" }}
        />
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={style}>
      <div className="absolute inset-0" style={bg.style} />
    </div>
  );
}
