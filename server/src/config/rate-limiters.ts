import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const avatarProfileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AVATAR_UPLOAD_RATE_LIMIT || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitos uploads de avatar. Tente novamente em 1 minuto." },
  keyGenerator: (req) => req.user?.userId != null ? String(req.user.userId) : ipKeyGenerator(req.ip ?? ""),
})

export const bannerAdminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.BANNER_UPLOAD_RATE_LIMIT || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitos uploads de banner. Tente novamente em 1 minuto." },
  keyGenerator: (req) => req.user?.userId != null ? String(req.user.userId) : ipKeyGenerator(req.ip ?? ""),
})
