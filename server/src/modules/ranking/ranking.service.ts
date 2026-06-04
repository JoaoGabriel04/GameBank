import { rankingRepository } from "./ranking.repository.js";
import { getRedis } from "../../lib/redis.js";
import { parseUserItems, type UserItemSnapshot } from "../shop/shop.repository.js";

const CACHE_KEY = "ranking:global";
const CACHE_TTL_S = 5 * 60; // 5 minutos

export class RankingService {
  async getGlobalRanking(limit = 100) {
    const redis = getRedis();

    if (redis) {
      try {
        const cached = await redis.get(CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch {
        // fallback to DB
      }
    }

    const users = await rankingRepository.findTopUsers(limit);
    const result = users.map((user, index) => {
      const items = parseUserItems(user.items);
      const equippedTitle = items.find((i) => i.equipped && i.type === "title")?.value;
      let parsedTitle = null;
      if (equippedTitle) {
        try {
          parsedTitle = JSON.parse(equippedTitle);
        } catch {
          // Invalid JSON in title value, skip parsing
        }
      }
      const equippedBadgeItem = items.find((i) => i.equipped && i.type === "badge");
      const badgeImageUrl = equippedBadgeItem?.imageUrl ?? null;
      let parsedBadge = null;
      if (equippedBadgeItem?.value) {
        try {
          parsedBadge = JSON.parse(equippedBadgeItem.value);
        } catch {
          // Invalid JSON in badge value, skip parsing
        }
      }
      const { items: _, ...rest } = user;
      return {
        position: index + 1,
        ...rest,
        title: parsedTitle?.title || null,
        badge: parsedBadge?.badge || null,
        badgeImageUrl,
      };
    });

    if (redis) {
      try {
        await redis.setEx(CACHE_KEY, CACHE_TTL_S, JSON.stringify(result));
      } catch {
        // non-critical
      }
    }

    return result;
  }

  async invalidateCache() {
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.del(CACHE_KEY);
    } catch {
      // non-critical
    }
  }
}
