import { PROPERTY_COLORS } from "@/types/game";
import type { Propriedade, SessionPropriedade } from "@/types/game";

export const COLOR_HEX: Record<string, string> = {
  lime: "#84cc16",
  green: "#15803d",
  red: "#dc2626",
  blue: "#2563eb",
  amber: "#fcd34d",
  orange: "#ea580c",
  pink: "#db2777",
  purple: "#7e22ce",
  zinc: "#fafafa",
};

export function getAccentHex(grupoCor: string | null): string {
  if (!grupoCor) return "#52525b";
  const found = PROPERTY_COLORS.find((c) => c.value === grupoCor);
  if (!found) return COLOR_HEX[grupoCor] ?? "#52525b";
  const match = found.bg?.match(/bg-(\w+)/);
  if (match) return COLOR_HEX[match[1]] ?? "#52525b";
  return "#52525b";
}

export const COLOR_LABELS: Record<string, string> = {};
for (const c of PROPERTY_COLORS) COLOR_LABELS[c.value] = c.label;

export const QUICK_VALUES = [100, 500, 2000, 5000, 10000, 50000, 100000];
