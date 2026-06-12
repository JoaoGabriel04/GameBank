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
    // Remove offers from previous day to always regenerate exactly 6
    await prisma.userDailyOffer.deleteMany({
      where: {
        userId,
        purchased: false,
        expiresAt: { gt: new Date() },
      },
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

    const expiresAt = getExpiresAt();

    // Helper: pick up to n items from a rarity pool (removes picked items)
    function pickN(rarity: string, n: number, used: Set<number>): typeof candidates {
      const pool = shuffle(byRarity[rarity] ?? []).filter(p => !used.has(p.id));
      const picked = pool.slice(0, Math.min(n, pool.length));
      picked.forEach(p => used.add(p.id));
      return picked;
    }

    const used = new Set<number>();
    const picks: typeof candidates = [];

    // Priority distribution
    picks.push(...pickN("COMUM", 2, used));
    picks.push(...pickN("INCOMUM", 2, used));
    picks.push(...pickN("RARO", 1, used));

    // 90% Epic / 10% Legendary (if available)
    if (Math.random() < 0.1) {
      picks.push(...pickN("LENDARIO", 1, used));
    }
    if (picks.length < 6) {
      picks.push(...pickN("EPICO", 6 - picks.length, used));
    }

    // Fill remaining slots with any rarity
    if (picks.length < 6) {
      const allRemaining = shuffle(
        Object.entries(byRarity)
          .filter(([_, items]) => items.some(i => !used.has(i.id)))
          .flatMap(([_, items]) => items.filter(i => !used.has(i.id)))
      );
      const fill = allRemaining.slice(0, 6 - picks.length);
      fill.forEach(f => { picks.push(f); used.add(f.id); });
    }

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
      const existing = await dailyOffersRepository.findActiveByUser(userId);
      return existing.map(resolveDailyOffer);
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
