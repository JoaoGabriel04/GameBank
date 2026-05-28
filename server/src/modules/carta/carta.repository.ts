import { prisma } from "../../lib/prisma.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CardData {
  id: number;
  texto: string;
  tipo: string;
  valor: number;
}

let baralhoCache: { sorte: CardData[]; reves: CardData[] } | null = null;

export function carregarBaralho(): { sorte: CardData[]; reves: CardData[] } {
  if (baralhoCache) return baralhoCache;
  const raw = readFileSync(
    resolve(process.cwd(), "data/cartas.json"),
    "utf-8"
  );
  baralhoCache = JSON.parse(raw);
  return baralhoCache!;
}

export class CartaRepository {
  async findPlayerById(id: number) {
    return prisma.sessionPlayer.findUnique({ where: { id } });
  }

  async updateCartaPrisao(playerId: number, value: boolean) {
    return prisma.sessionPlayer.update({
      where: { id: playerId },
      data: { carta_prisao: value },
    });
  }

  async updatePlayerBalance(playerId: number, delta: number) {
    return prisma.sessionPlayer.update({
      where: { id: playerId },
      data: delta >= 0
        ? { saldo: { increment: delta } }
        : { saldo: { decrement: Math.abs(delta) } },
    });
  }

  async findSessionPlayers(sessionId: number, excludeId?: number) {
    const where: any = { sessionId };
    if (excludeId !== undefined) where.id = { not: excludeId };
    return prisma.sessionPlayer.findMany({ where });
  }

  async createHistorico(data: {
    sessionId: number;
    data: Date;
    tipo: string;
    detalhes: string;
  }) {
    return prisma.historico.create({ data });
  }
}
