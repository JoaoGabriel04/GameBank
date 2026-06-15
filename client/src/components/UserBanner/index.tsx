"use client";

import { useRef, useEffect } from "react";
import { animateGradientLoop } from "@/lib/animations";
import { resolveBannerBackground } from "@/constants/banners";
import BannerParticulas from "@/components/BannerParticulas";
import { useBannerGlow } from "@/hooks/useBannerGlow";

const COR_LENDARIO = "#fbbf24";

type UserBannerProps = {
  banner?: string | null;
  imageUrl?: string | null;
  animated?: boolean;
  rarity?: string | null;
  className?: string;
  style?: React.CSSProperties;
};

export default function UserBanner({ banner, imageUrl, animated = false, rarity, className = "", style }: UserBannerProps) {
  const value = imageUrl ?? banner ?? null;
  const bg = resolveBannerBackground(value);
  const isGradient = !imageUrl && !value?.startsWith("http");
  const isLendario = rarity === "LENDARIO";

  const animRef = useRef<HTMLDivElement>(null);
  const glowRef = useBannerGlow(COR_LENDARIO, isLendario);

  useEffect(() => {
    if (!animRef.current) return;
    const tween = animateGradientLoop(animRef.current, 3);
    return () => { tween.kill(); };
  }, []);

  const callerPositions = /\b(absolute|fixed|sticky)\b/.test(className);
  const wrapperClass = `${callerPositions ? "" : "relative"} overflow-hidden ${className}`.trim();

  const shimmerGradient = `linear-gradient(
    105deg,
    transparent 30%,
    ${COR_LENDARIO}22 45%,
    rgba(255,255,255,0.35) 50%,
    ${COR_LENDARIO}22 55%,
    transparent 70%
  )`;

  if (animated && isGradient) {
    const gradientValue = (bg.style.background ?? bg.style.backgroundImage) as string;
    return (
      <div
        ref={glowRef}
        className={wrapperClass}
        style={{
          ...style,
          ...(isLendario ? { boxShadow: `0 0 4px ${COR_LENDARIO}22` } : undefined),
        }}
      >
        <div
          ref={animRef}
          className="absolute inset-0"
          style={{ backgroundImage: gradientValue, backgroundSize: "300% 300%", backgroundPosition: "0% 50%" }}
        />
        {isLendario && (
          <div
            className="banner-shimmer-pass absolute inset-0"
            style={{ background: shimmerGradient, zIndex: 2, pointerEvents: "none" }}
          />
        )}
        {isLendario && <BannerParticulas cor={COR_LENDARIO} ativo />}
      </div>
    );
  }

  return (
    <div
      ref={glowRef}
      className={wrapperClass}
      style={{
        ...style,
        ...(isLendario ? { boxShadow: `0 0 4px ${COR_LENDARIO}22` } : undefined),
      }}
    >
      <div className="absolute inset-0" style={bg.style} />
      {isLendario && (
        <div
          className="banner-shimmer-pass absolute inset-0"
          style={{ background: shimmerGradient, zIndex: 2, pointerEvents: "none" }}
        />
      )}
      {isLendario && <BannerParticulas cor={COR_LENDARIO} ativo />}
    </div>
  );
}
