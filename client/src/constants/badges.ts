export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export type BadgePreset = {
  slug: string;
  label: string;
  description: string;
  rarity: BadgeRarity;
  color: string;
  bgColor: string;
  emoji: string;
  seasonal?: boolean;
  expirationDate?: Date | null;
  limitedEdition?: boolean;
  maxCopies?: number;
  currentCopies?: number;
};

export const BADGE_PRESETS: BadgePreset[] = [
  {
    slug: "diamond",
    label: "Diamante",
    description: "Símbolo supremo do poder econômico",
    rarity: "legendary",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500",
    emoji: "💎",
  },
  {
    slug: "emerald",
    label: "Esmeralda",
    description: "Um verde que atrai sorte aos negócios",
    rarity: "rare",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500",
    emoji: "🟢",
  },
  {
    slug: "ruby",
    label: "Rubi",
    description: "Vermelho de sangue frio e coragem",
    rarity: "epic",
    color: "text-red-400",
    bgColor: "bg-red-500",
    emoji: "🔴",
  },
  {
    slug: "champion-june-2026",
    label: "Campeão de Junho",
    description: "Vencedor do desafio do mês de junho",
    rarity: "legendary",
    color: "text-orange-400",
    bgColor: "bg-orange-500",
    emoji: "🏆",
    seasonal: true,
    expirationDate: new Date("2026-07-01"),
  },
  {
    slug: "founder",
    label: "Fundador",
    description: "Um dos primeiros jogadores do supermáquina",
    rarity: "legendary",
    color: "text-purple-400",
    bgColor: "bg-purple-500",
    emoji: "👑",
    limitedEdition: true,
    maxCopies: 100,
    currentCopies: 12,
  },
];

export function resolveBadge(slug?: string | null): BadgePreset | null {
  if (!slug) return null;
  return BADGE_PRESETS.find((b) => b.slug === slug) ?? null;
}

export function getBadgeStatus(badge: BadgePreset): "active" | "expiring_soon" | "expired" {
  if (!badge.seasonal || !badge.expirationDate) return "active";

  const now = new Date();
  const expirationDate = new Date(badge.expirationDate);
  const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiration < 0) return "expired";
  if (daysUntilExpiration <= 7) return "expiring_soon";
  return "active";
}

export function getExpirationText(badge: BadgePreset): string | null {
  if (!badge.seasonal || !badge.expirationDate) return null;

  const now = new Date();
  const expirationDate = new Date(badge.expirationDate);
  const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiration < 0) return "Expirado";
  if (daysUntilExpiration === 0) return "Expira hoje";
  if (daysUntilExpiration === 1) return "Expira amanhã";
  return `Expira em ${daysUntilExpiration} dias`;
}

export function getLimitedEditionStatus(badge: BadgePreset): "available" | "rare" | "very_rare" | "sold_out" | null {
  if (!badge.limitedEdition || badge.maxCopies === undefined) return null;

  const remaining = badge.maxCopies - (badge.currentCopies || 0);
  const percentageRemaining = (remaining / badge.maxCopies) * 100;

  if (remaining === 0) return "sold_out";
  if (percentageRemaining <= 10) return "very_rare";
  if (percentageRemaining <= 25) return "rare";
  return "available";
}

export function getLimitedEditionText(badge: BadgePreset): string | null {
  if (!badge.limitedEdition || badge.maxCopies === undefined) return null;

  const remaining = badge.maxCopies - (badge.currentCopies || 0);

  if (remaining === 0) return "Esgotado";
  return `${remaining}/${badge.maxCopies} restantes`;
}
