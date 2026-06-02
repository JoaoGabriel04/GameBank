import { rankingRepository } from "./ranking.repository.js";
import { getRedis } from "../../lib/redis.js";
import { type UserItemSnapshot } from "../shop/shop.repository.js";

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
      const items = (user.items ?? []) as unknown as UserItemSnapshot[];
      const equippedTitle = items.find((i) => i.equipped && i.type === "title")?.value;
      const parsedTitle = equippedTitle ? JSON.parse(equippedTitle) : null;
      const equippedBadge = items.find((i) => i.equipped && i.type === "badge")?.value;
      const parsedBadge = equippedBadge ? JSON.parse(equippedBadge) : null;
      const { items: _, ...rest } = user;
      return {
        position: index + 1,
        ...rest,
        title: parsedTitle?.title || null,
        badge: parsedBadge?.badge || null,
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
