import { AppError } from "../../middleware/error-handler.middleware.js";
import { shopRepository, parseUserItems, type UserItemRef } from "./shop.repository.js";
import { prisma } from "../../lib/prisma.js";
import { RankingService } from "../ranking/ranking.service.js";

export class ShopService {
  private rankingService = new RankingService();

  async listItems() {
    return shopRepository.findAvailableItems();
  }

  async buyItem(userId: number, itemId: number) {
    if (itemId === 0) {
      throw new AppError(400, "Não é possível comprar o banner padrão.");
    }

    const shopItem = await shopRepository.findShopItem(itemId);
    if (!shopItem || !shopItem.available) {
      throw new AppError(404, "Item não encontrado");
    }

    await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { coins: true, user_items: true },
        });
        if (!user) throw new AppError(404, "Usuário não encontrado");

        const refs = parseUserItems(user.user_items);
        if (refs.some((r) => r.item_id === itemId)) {
          throw new AppError(400, "Você já possui este item");
        }

        if (user.coins < shopItem.price) {
          throw new AppError(400, "Coins insuficientes");
        }

        const newRef: UserItemRef = {
          item_id: shopItem.id,
          equipped: false,
          acquiredAt: new Date().toISOString(),
        };

        await tx.user.update({
          where: { id: userId },
          data: {
            coins: { decrement: shopItem.price },
            user_items: [...refs, newRef] as any,
          },
        });
      },
      { timeout: 15000, maxWait: 10000 }
    );

    await this.rankingService.invalidateCache();
    return { message: "Item comprado com sucesso", item: shopItem };
  }

  async equipItem(userId: number, itemId: number) {
    if (itemId === 0) {
      return this.equipDefaultBanner(userId);
    }

    const shopItem = await shopRepository.findShopItem(itemId);
    if (!shopItem) throw new AppError(404, "Item não encontrado na loja.");

    let nextEquipped = false;

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { user_items: true },
      });
      if (!user) throw new AppError(404, "Usuário não encontrado");

      const refs = parseUserItems(user.user_items);
      const target = refs.find((r) => r.item_id === itemId);
      if (!target) throw new AppError(404, "Item não encontrado");

      nextEquipped = !target.equipped;

      const allShopItems = await tx.shopItem.findMany({
        where: { id: { in: refs.map((r) => r.item_id) } },
        select: { id: true, type: true },
      });
      const typeMap = new Map(allShopItems.map((si) => [si.id, si.type]));

      const finalRefs = refs.map((r) => {
        if (r.item_id === itemId) return { ...r, equipped: nextEquipped };
        if (r.equipped && typeMap.get(r.item_id) === shopItem.type) return { ...r, equipped: false };
        return r;
      });

      const updateData: any = { user_items: finalRefs };

      if (shopItem.type === "banner") {
        if (nextEquipped) {
          updateData.banner = shopItem.value;
          updateData.spriteId = shopItem.banner?.spriteId ?? null;
        } else {
          const hasDefault = finalRefs.some((r) => r.item_id === 0);
          if (hasDefault) finalRefs.forEach((r) => { if (r.item_id === 0) r.equipped = true; });
          updateData.user_items = finalRefs;
          updateData.banner = null;
          updateData.spriteId = null;
        }
      }

      await tx.user.update({ where: { id: userId }, data: updateData });
    });

    await this.rankingService.invalidateCache();
    return { message: "Item atualizado", equipped: nextEquipped };
  }

  private async equipDefaultBanner(userId: number) {
    const user = await shopRepository.findUser(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado");

    const refs = parseUserItems(user.user_items);

    // Fetch all banner items to know which are banners
    const bannerIds = refs
      .filter((r) => r.item_id !== 0)
      .map((r) => r.item_id);
    const banners = bannerIds.length > 0
      ? await prisma.shopItem.findMany({ where: { id: { in: bannerIds }, type: "banner" }, select: { id: true } })
      : [];
    const bannerIdSet = new Set(banners.map((b) => b.id));

    const updatedRefs = refs.map((r) => ({
      ...r,
      equipped: r.item_id === 0 ? true : (bannerIdSet.has(r.item_id) ? false : r.equipped),
    }));

    await prisma.user.update({
      where: { id: userId },
      data: { user_items: updatedRefs as any, banner: null, spriteId: null },
    });

    await this.rankingService.invalidateCache();
    return { message: "Item atualizado", equipped: true };
  }

  async sellItem(userId: number, itemId: number) {
    if (itemId === 0) {
      throw new AppError(400, "Não é possível vender o banner padrão.");
    }

    const shopItem = await shopRepository.findShopItem(itemId);
    if (!shopItem) throw new AppError(404, "Item não encontrado na loja.");

    const refund = Math.floor(shopItem.price / 2);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { user_items: true },
      });
      if (!user) throw new AppError(404, "Usuário não encontrado");

      const refs = parseUserItems(user.user_items);
      const target = refs.find((r) => r.item_id === itemId);
      if (!target) throw new AppError(404, "Item não encontrado no seu inventário.");

      const filtered = refs.filter((r) => r.item_id !== itemId);
      const updateData: any = { user_items: filtered as any, coins: { increment: refund } };

      if (shopItem.type === "banner" && target.equipped) {
        const hasDefault = filtered.some((r) => r.item_id === 0);
        if (hasDefault) {
          filtered.forEach((r) => { if (r.item_id === 0) r.equipped = true; });
        }
        updateData.user_items = filtered;
        updateData.banner = null;
        updateData.spriteId = null;
      }

      await tx.user.update({ where: { id: userId }, data: updateData });
    });

    await this.rankingService.invalidateCache();
    return { message: `"${shopItem.name}" vendido por ${refund} coins.`, refund };
  }

  async syncUserBanner(userId: number) {
    await shopRepository.syncUserBanner(userId);
    await this.rankingService.invalidateCache();
  }
}
