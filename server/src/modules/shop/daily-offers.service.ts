import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { dailyOffersRepository, resolveDailyOffer } from "./daily-offers.repository.js";
import { parseUserItems } from "./shop.repository.js";

const PRECO_POR_RARIDADE: Record<string, number> = {
  COMUM: 100,
  INCOMUM: 250,
  RARO: 500,
  EPICO: 1000,
  LENDARIO: 2500,
};

function getExpiresAt(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
  if (tomorrow <= now) tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export class DailyOffersService {
  async getOffers(userId: number) {
    // 🔒 Stability: return existing active offers (don't regenerate per refresh)
    const existing = await dailyOffersRepository.findActiveByUser(userId);
    if (existing.length > 0) {
      return existing.map(resolveDailyOffer);
    }

    // Clean expired offers
    await prisma.userDailyOffer.deleteMany({
      where: { userId, expiresAt: { lte: new Date() } },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { user_items: true },
    });
    const ownedIds = new Set(
      (parseUserItems(user?.user_items) ?? []).map((r) => r.item_id)
    );

    // Fetch all fragmentáveis the user doesn't own
    const candidates = await prisma.shopItem.findMany({
      where: {
        available: true,
        fragmentavel: true,
        id: { notIn: Array.from(ownedIds) },
      },
      orderBy: { raridade: "desc" },
    });

    if (candidates.length === 0) return [];

    // Group by rarity
    const byRarity: Record<string, typeof candidates> = {};
    for (const c of candidates) {
      const r = c.raridade ?? "COMUM";
      if (!byRarity[r]) byRarity[r] = [];
      byRarity[r].push(c);
    }

    const RARITY_ORDER = ["COMUM", "INCOMUM", "RARO", "EPICO", "LENDARIO"];
    const SHORT_MAP: Record<string, string> = { C:"COMUM", I:"INCOMUM", R:"RARO", E:"EPICO", L:"LENDARIO" };

    // Distribution rules keyed by sorted empty-rarity letters
    const DISTRIBUTION_RULES: Record<string, string[]> = {
      "":        ["C","C","I","I","R","E/L"],
      "C":       ["I","I","I","R","R","E/L"],
      "I":       ["C","C","C","R","R","E/L"],
      "R":       ["C","C","C","I","I","E/L"],
      "C,I":     ["R","R","R","E","E","L"],
      "C,R":     ["I","I","I","E","E","L"],
      "I,R":     ["C","C","C","E","E","L"],
      "C,I,R":   ["E","E","E","L","L","L"],
    };

    const emptyKey = RARITY_ORDER
      .filter(r => (byRarity[r] ?? []).length === 0)
      .map(r => r[0])
      .join(",");

    const rule = DISTRIBUTION_RULES[emptyKey] ?? DISTRIBUTION_RULES[""];

    // Helper: pick one unused item from a rarity, returns null if none
    function pickOne(rarity: string, used: Set<number>): (typeof candidates)[0] | null {
      const pool = shuffle(byRarity[rarity] ?? []).filter(p => !used.has(p.id));
      return pool.length > 0 ? pool[0] : null;
    }

    const used = new Set<number>();
    const picks: typeof candidates = [];

    for (const slot of rule) {
      if (picks.length >= 6) break;
      if (slot === "E/L") {
        const bonusTarget = Math.random() < 0.1 ? "LENDARIO" : "EPICO";
        const picked = pickOne(bonusTarget, used) ?? pickOne(bonusTarget === "EPICO" ? "LENDARIO" : "EPICO", used);
        if (picked) { used.add(picked.id); picks.push(picked); }
      } else {
        const picked = pickOne(SHORT_MAP[slot], used);
        if (picked) { used.add(picked.id); picks.push(picked); }
      }
    }

    // Fill remaining if any slot couldn't pick
    if (picks.length < 6) {
      const allRemaining = shuffle(
        Object.values(byRarity).flat().filter(i => !used.has(i.id))
      );
      const fill = allRemaining.slice(0, 6 - picks.length);
      fill.forEach(f => { used.add(f.id); picks.push(f); });
    }

    const expiresAt = getExpiresAt();

    // Create offers in DB
    const created: any[] = [];
    for (const item of picks) {
      const preco = PRECO_POR_RARIDADE[item.raridade ?? "COMUM"] ?? 100;

      const pct = randomBetween(0.05, 0.1);
      const total = Math.max(1, Math.round((item.fragmentosTotal ?? 20) * pct));

      try {
        const offer = await dailyOffersRepository.createOffer(
          userId,
          item.id,
          preco,
          total,
          expiresAt,
        );
        created.push({ ...offer, item });
      } catch (err: any) {
        // P2002 = unique constraint — offer already exists from concurrent request
        if (err?.code === "P2002") continue;
        throw err;
      }
    }

    // If nothing was created (all already existed), return existing
    if (created.length === 0) {
      const existing2 = await dailyOffersRepository.findActiveByUser(userId);
      return existing2.map(resolveDailyOffer);
    }

    return created.map(resolveDailyOffer);
  }

  async buyOffer(userId: number, offerId: number) {
    const offer = await dailyOffersRepository.findOfferById(offerId);

    if (!offer) throw new AppError(404, "Oferta não encontrada");
    if (offer.userId !== userId) throw new AppError(403, "Esta oferta não pertence a você");
    if (offer.purchased) throw new AppError(400, "Oferta já foi comprada");

    const now = new Date();
    if (offer.expiresAt <= now) throw new AppError(410, "Oferta expirou");

    let fragmentosAtuais = 0;

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { coins: true },
      });
      if (!user) throw new AppError(404, "Usuário não encontrado");
      if (user.coins < offer.preco) throw new AppError(400, "Coins insuficientes");

      await tx.user.update({
        where: { id: userId },
        data: { coins: { decrement: offer.preco } },
      });

      const frag = await tx.userFragment.upsert({
        where: { userId_itemId: { userId, itemId: offer.itemId } },
        create: { userId, itemId: offer.itemId, quantidade: offer.quantidade },
        update: { quantidade: { increment: offer.quantidade } },
      });

      fragmentosAtuais = frag.quantidade;

      await dailyOffersRepository.markPurchased(offerId);
    }, { timeout: 15000, maxWait: 10000 });

    return {
      message: `+${offer.quantidade} fragmentos de "${offer.item?.name ?? ""}"!`,
      offerId,
      coins: offer.preco,
      fragmentosAtuais,
    };
  }
}
