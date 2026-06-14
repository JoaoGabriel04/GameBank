import { AppError } from "../../middleware/error-handler.middleware.js";
import { validateAndProcessAvatar } from "../../lib/image-validation.js";
import {
  uploadAvatarToCloudinary,
  deleteCloudinaryAvatar,
  rollbackCloudinaryUpload,
} from "../avatar/avatar.service.js";
import { isAllowedAvatarPreset, presetAvatarValue } from "../../shared/constants/avatars.js";
import { isAllowedBannerPreset } from "../../shared/constants/banners.js";
import { getRedis } from "../../lib/redis.js";
import { prisma } from "../../lib/prisma.js";
import { profileRepository } from "./profile.repository.js";
import { getLevelFromXp, xpForLevel, totalXpForLevels } from "../../utils/level.js";
import { getTrophyAssetName } from "../../shared/constants/trophies.js";
import { shopRepository } from "../shop/shop.repository.js";

export class ProfileService {
  async getProfile(userId: number) {
    const user = await profileRepository.findWithItemsAndMissions(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado");

    if (user.xp >= xpForLevel(user.level)) {
      const totalXp = totalXpForLevels(user.level) + user.xp;
      const correctLevel = getLevelFromXp(totalXp);
      const xpInLevel = totalXp - totalXpForLevels(correctLevel);
      await profileRepository.update(user.id, { level: correctLevel, xp: Math.max(0, xpInLevel) });
      user.level = correctLevel;
      user.xp = Math.max(0, xpInLevel);
    }

    const items = await shopRepository.resolveUserItems(userId);

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
      id: user.id,
      nome: user.nome,
      avatarUrl: user.avatarUrl,
      avatarUpdatedAt: user.avatarUpdatedAt?.toISOString() ?? null,
      banner: user.banner ?? null,
      bannerAnimated,
      frame: equippedFrameItem?.value ?? null,
      frameType: equippedFrameItem?.frameTipo ?? null,
      frameAnimated,
      frameScale: equippedFrameItem?.frameScale ?? 145,
      level: user.level,
      xp: user.xp,
      coins: user.coins,
      diamonds: user.diamonds,
      totalGames: user.totalGames,
      totalWins: user.totalWins,
      totalTop3: user.totalTop3,
      trophies: user.trophies,
      trophyAsset: getTrophyAssetName(user.trophies),
      title: parsedTitle?.title || null,
      titleAnimated,
      titleRaridade,
      badge: parsedBadge?.badge || null,
      badgeImageUrl,
      items,
      missions: user.missions.map((m) => ({
        id: m.mission.id,
        name: m.mission.name,
        description: m.mission.description,
        metric: m.mission.metric,
        target: m.mission.target,
        progress: m.progress,
        completed: m.completed,
        xpReward: m.mission.xpReward,
        coinReward: m.mission.coinReward,
      })),
    };
  }

  async getHistory(userId: number, limit = 20) {
    const results = await profileRepository.findGameResults(userId, limit);

    return results.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      position: r.position,
      patrimony: r.patrimony,
      xpEarned: r.xpEarned,
      coinsEarned: r.coinsEarned,
      trophyDelta: r.trophyDelta,
      trophyBefore: r.trophyBefore,
      trophyAfter: r.trophyAfter,
      createdAt: r.createdAt,
    }));
  }

  async updateProfile(
    userId: number,
    data: { nome?: string; avatarPreset?: string; fileBuffer?: Buffer; fileMime?: string; banner?: string | null }
  ) {
    const current = await profileRepository.findUser(userId);
    if (!current) throw new AppError(404, "Usuário não encontrado");

    if (data.nome !== undefined && (data.nome.length < 1 || data.nome.length > 30)) {
      throw new AppError(400, "Apelido deve ter entre 1 e 30 caracteres");
    }

    if (data.banner !== undefined && data.banner !== null && data.banner.length > 2000) {
      throw new AppError(400, "Banner muito longo");
    }

    const updateData: Record<string, unknown> = {};
    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.banner !== undefined) updateData.banner = data.banner;

    let newPublicId: string | null = null;

    if (data.fileBuffer) {
      const processed = await validateAndProcessAvatar(data.fileBuffer, data.fileMime);
      const uploaded = await uploadAvatarToCloudinary(userId, processed.buffer);
      updateData.avatarUrl = uploaded.url;
      newPublicId = uploaded.publicId;
      updateData.avatarPublicId = newPublicId;
      updateData.avatarUpdatedAt = new Date();
    } else if (data.avatarPreset) {
      if (!isAllowedAvatarPreset(data.avatarPreset)) throw new AppError(400, "Avatar preset inválido");
      updateData.avatarUrl = presetAvatarValue(data.avatarPreset);
      updateData.avatarPublicId = null;
      updateData.avatarUpdatedAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return {
        id: current.id,
        nome: current.nome,
        avatarUrl: current.avatarUrl,
        avatarUpdatedAt: current.avatarUpdatedAt?.toISOString() ?? null,
        banner: current.banner ?? null,
      };
    }

    const oldPublicId = current.avatarPublicId;
    try {
      const user = await profileRepository.update(userId, updateData);

      if (oldPublicId && oldPublicId !== newPublicId && updateData.avatarUrl !== undefined) {
        deleteCloudinaryAvatar(oldPublicId).catch((err) =>
          console.error("[avatar] Exclusão antiga falhou:", oldPublicId, err)
        );
      }

      // Invalidate session cache for all active sessions the user is in
      this.invalidateSessionCaches(userId).catch(() => {});

      return {
        id: user.id,
        nome: user.nome,
        avatarUrl: user.avatarUrl,
        avatarUpdatedAt: user.avatarUpdatedAt?.toISOString() ?? null,
        banner: user.banner ?? null,
      };
    } catch (err) {
      if (newPublicId) await rollbackCloudinaryUpload(newPublicId);
      throw err;
    }
  }

  private async invalidateSessionCaches(userId: number) {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          status: { in: ["Esperando", "Em Andamento"] },
          jogadores: { some: { userId } },
        },
        select: { id: true },
      });
      if (sessions.length === 0) return;
      const redis = getRedis();
      if (!redis) return;
      await Promise.all(sessions.map((s) => redis.del(`session:cache:${s.id}`)));
    } catch {
      // Non-critical
    }
  }

  async clearHistory(userId: number) {
    const { count } = await profileRepository.clearHistory(userId);
    return { deleted: count };
  }

  xpForLevel(level: number): number {
    return xpForLevel(level);
  }
}
