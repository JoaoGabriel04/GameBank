const PLAYER_COLOR_ORDER = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "pink",
  "emerald",
  "black",
] as const;

/** Cor do peão no tabuleiro — derivada do userId, sem escolha manual. */
export function pickPlayerColor(userId: number, usedColors: string[]): string {
  const preferred = PLAYER_COLOR_ORDER[userId % PLAYER_COLOR_ORDER.length];
  if (!usedColors.includes(preferred)) return preferred;
  const free = PLAYER_COLOR_ORDER.find((c) => !usedColors.includes(c));
  return free ?? "zinc";
}
