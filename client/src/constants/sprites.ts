import {
  Crown, Trophy, Shield, Target, TrendingUp, Palette,
  Sparkles, Coins, Gamepad2, Building, Home,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SpriteCatalogEntry = {
  id: string;
  icon: LucideIcon;
  label: string;
};

export const SPRITE_CATALOG: SpriteCatalogEntry[] = [
  { id: "crown",    icon: Crown,      label: "Coroa" },
  { id: "trophy",   icon: Trophy,     label: "Troféu" },
  { id: "shield",   icon: Shield,     label: "Escudo" },
  { id: "target",   icon: Target,     label: "Alvo" },
  { id: "trending", icon: TrendingUp, label: "Ascensão" },
  { id: "palette",  icon: Palette,    label: "Arte" },
  { id: "sparkles", icon: Sparkles,   label: "Brilho" },
  { id: "coins",    icon: Coins,      label: "Moedas" },
  { id: "gamepad",  icon: Gamepad2,   label: "Jogo" },
  { id: "building", icon: Building,   label: "Império" },
  { id: "home",     icon: Home,       label: "Lar" },
];

export function resolveSprite(id?: string | null): SpriteCatalogEntry | undefined {
  if (!id) return undefined;
  return SPRITE_CATALOG.find((s) => s.id === id);
}
