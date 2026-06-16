import { rankingRepository } from "./ranking.repository.js";
import { getRedis } from "../../lib/redis.js";
import { shopRepository } from "../shop/shop.repository.js";
import { logger } from "../../lib/logger.js";

const CACHE_KEY = "ranking:global";
const CACHE_TTL_S = 5 * 60;

export class RankingService {
  async getGlobalRanking(limit = 100) {
    const redis = getRedis();

    if (redis) {
      try {
        const cached = await redis.get(CACHE_KEY);
        if (cached) {
          logger.debug("ranking servido do cache");
          return JSON.parse(cached);
        }
      } catch {
        // fallback to DB
      }
    }

    logger.debug("ranking cache miss — buscando do banco");
    const users = await rankingRepository.findTopUsers(limit);

    // Batch resolve all user items
    const itemsPromises = users.map(async (user) => {
      const items = await shopRepository.resolveUserItems(user.id);
      return { userId: user.id, items };
    });
    const allItems = await Promise.all(itemsPromises);
    const itemsByUser = new Map(allItems.map((i) => [i.userId, i.items]));

    const result = users.map((user, index) => {
      const items = itemsByUser.get(user.id) ?? [];
      const equippedTitleItem = items.find((i) => i.equipped && i.type === "title");
      const equippedTitle = equippedTitleItem?.value;
      let parsedTitle = null;
      if (equippedTitle) {
        try {
          parsedTitle = JSON.parse(equippedTitle);
        } catch {
          // Invalid JSON in title value, skip parsing
        }
      }
      const titleAnimated = equippedTitleItem?.animated ?? false;
      const titleRaridade = equippedTitleItem?.raridade ?? null;
      const equippedBannerItem = items.find((i) => i.equipped && i.type === "banner");
      const bannerAnimated = equippedBannerItem?.animated ?? false;
      const bannerRaridade = equippedBannerItem?.raridade ?? null;
      const equippedFrameItem = items.find((i) => i.equipped && i.type === "frame") as { value?: string | null; animated?: boolean; frameTipo?: string | null; frameAnimated?: boolean; frameScale?: number | null } | undefined;
      const frameAnimated = equippedFrameItem?.frameAnimated ?? equippedFrameItem?.animated ?? false;
      const equippedBadgeItem = items.find((i) => i.equipped && i.type === "badge");
      const badgeImageUrl = equippedBadgeItem?.imageUrl ?? null;
      let parsedBadge = null;
      if (equippedBadgeItem?.value) {
        try {
          parsedBadge = JSON.parse(equippedBadgeItem.value);
        } catch {
          parsedBadge = { badge: equippedBadgeItem.value };
        }
      }
      return {
        position: index + 1,
        id: user.id,
        nome: user.nome,
        avatarUrl: user.avatarUrl,
        avatarUpdatedAt: user.avatarUpdatedAt,
        level: user.level,
        xp: user.xp,
        totalGames: user.totalGames,
        totalWins: user.totalWins,
        totalTop3: user.totalTop3,
        trophies: user.trophies,
        banner: user.banner,
        bannerAnimated,
        bannerRaridade,
        frame: equippedFrameItem?.value ?? null,
        frameType: equippedFrameItem?.frameTipo ?? null,
        frameAnimated,
        frameScale: equippedFrameItem?.frameScale ?? 145,
        title: parsedTitle?.title || null,
        titleAnimated,
        titleRaridade,
        badge: parsedBadge?.badge || null,
        badgeImageUrl,
      };
    });

    if (redis) {
      try {
        await redis.setEx(CACHE_KEY, CACHE_TTL_S, JSON.stringify(result));
        logger.debug("ranking salvo no cache");
      } catch {
        logger.warn("ranking falha ao salvar no cache");
      }
    }

    return result;
  }

  async invalidateCache() {
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.del(CACHE_KEY);
      logger.info("cache de ranking invalidado");
    } catch (err) {
      logger.warn({ err }, "ranking falha ao invalidar cache");
    }
  }
}
