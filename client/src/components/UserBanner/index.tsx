"use client";

import { motion } from "framer-motion";
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

  if (animated && isGradient) {
    const gradientValue = (bg.style.background ?? bg.style.backgroundImage) as string;
    return (
      <div className={wrapperClass} style={style}>
        <motion.div
          className="absolute inset-0"
          style={{ backgroundImage: gradientValue, backgroundSize: "300% 300%" }}
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
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
