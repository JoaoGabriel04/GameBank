import { AppError } from "../../middleware/error-handler.middleware.js";
import { shopRepository, parseUserItems, type UserItemSnapshot } from "./shop.repository.js";
import { prisma } from "../../lib/prisma.js";
import { RankingService } from "../ranking/ranking.service.js";

export class ShopService {
  private rankingService = new RankingService();

  async listItems() {
    return shopRepository.findAvailableItems();
  }

  async buyItem(userId: number, itemId: number) {
    // Fetch shop item with full details
    const shopItem = await shopRepository.findShopItem(itemId);
    if (!shopItem || !shopItem.available) {
      throw new AppError(404, "Item não encontrado");
    }

    // Fetch user with current items
    const user = await shopRepository.findUser(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado");

    const currentItems = parseUserItems(user.items);

    // Check if user already owns this item
    if (currentItems.some(i => i.id === itemId)) {
      throw new AppError(400, "Você já possui este item");
    }

    // Check coins
    if (user.coins < shopItem.price) {
      throw new AppError(400, "Coins insuficientes");
    }

    // Create snapshot of new item
    const newItem: UserItemSnapshot = {
      id: shopItem.id,
      name: shopItem.name,
      description: shopItem.description,
      type: shopItem.type as 'title' | 'badge' | 'banner',
      value: shopItem.value,
      icon: shopItem.icon,
      spriteId: shopItem.banner?.spriteId ?? null,
      rarity: shopItem.rarity ?? null,
      imageUrl: shopItem.imageUrl ?? null,
      equipped: false,
      acquiredAt: new Date().toISOString(),
    };

    // Transact: decrement coins and add item.
    // Both updates MUST go through `tx` so they share the same connection
    // and row lock — calling shopRepository.saveUserItems (which uses the
    // global prisma) inside the callback deadlocks against itself and
    // the transaction times out at ~15s with P2028.
    await prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { coins: { decrement: shopItem.price } },
        });
        await tx.user.update({
          where: { id: userId },
          data: { items: [...currentItems, newItem] as any },
        });
      },
      { timeout: 15000, maxWait: 10000 }
    );

    // Invalidate ranking cache since user inventory changed
    await this.rankingService.invalidateCache();

    return { message: "Item comprado com sucesso", item: shopItem };
  }

  async equipItem(userId: number, itemId: number) {
    // Special case: id=0 is the "Padrão" (default banner)
    if (itemId === 0) {
      return this.equipDefaultBanner(userId);
    }

    // Fetch user with current items
    const user = await shopRepository.findUser(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado");

    const currentItems = parseUserItems(user.items);

    // Find target item
    const targetItem = currentItems.find(i => i.id === itemId);
    if (!targetItem) throw new AppError(404, "Item não encontrado");

    // Calculate next state
    const nextEquipped = !targetItem.equipped;

    // Update items array
    const updatedItems = currentItems.map(item => {
      // Deequip all items of same type
      if (item.type === targetItem.type && item.equipped && item.id !== itemId) {
        return { ...item, equipped: false };
      }
      // Toggle target item
      if (item.id === itemId) {
        return { ...item, equipped: nextEquipped };
      }
      return item;
    });

    // If deequipping a banner, auto-equip the default
    let defaultBannerEquipped = false;
    if (targetItem.type === 'banner' && !nextEquipped) {
      const hasDefault = updatedItems.some(i => i.id === 0);
      if (hasDefault) {
        updatedItems.forEach(item => {
          if (item.id === 0) {
            item.equipped = true;
            defaultBannerEquipped = true;
          }
        });
      }
    }

    // Update user: items array + banner/sprite if needed
    const updateData: any = { items: updatedItems };

    if (targetItem.type === 'banner') {
      if (nextEquipped && targetItem.value) {
        // Equiping a banner: set its value
        updateData.banner = targetItem.value;
        updateData.spriteId = targetItem.spriteId ?? null;
      } else if (!nextEquipped || defaultBannerEquipped) {
        // Deequipping a banner or auto-equipping default: clear banner
        updateData.banner = null;
        updateData.spriteId = null;
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Invalidate ranking cache since user banner/items changed
    await this.rankingService.invalidateCache();

    return { message: "Item atualizado", equipped: nextEquipped };
  }

  private async equipDefaultBanner(userId: number) {
    const user = await shopRepository.findUser(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado");

    const currentItems = parseUserItems(user.items);

    // Deequip all banners, equip default
    const updatedItems = currentItems.map(item => ({
      ...item,
      equipped: item.id === 0 ? true : (item.type === 'banner' ? false : item.equipped),
    }));

    await prisma.user.update({
      where: { id: userId },
      data: {
        items: updatedItems,
        banner: null,
        spriteId: null,
      },
    });

    // Invalidate ranking cache since user banner changed
    await this.rankingService.invalidateCache();

    return { message: "Item atualizado", equipped: true };
  }

  async sellItem(userId: number, itemId: number) {
    if (itemId === 0) {
      throw new AppError(400, "Não é possível vender o banner padrão.");
    }

    const user = await shopRepository.findUser(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado");

    const currentItems = parseUserItems(user.items);
    const targetItem = currentItems.find(i => i.id === itemId);
    if (!targetItem) throw new AppError(404, "Item não encontrado no seu inventário.");

    const shopItem = await shopRepository.findShopItem(itemId);
    if (!shopItem) throw new AppError(404, "Item não encontrado na loja.");

    const refund = Math.floor(shopItem.price / 2);

    const updatedItems = currentItems.filter(i => i.id !== itemId);

    const updateData: any = { items: updatedItems, coins: { increment: refund } };

    if (targetItem.type === 'banner' && targetItem.equipped) {
      updateData.banner = null;
      updateData.spriteId = null;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await this.rankingService.invalidateCache();

    return { message: `"${targetItem.name}" vendido por ${refund} coins.`, refund };
  }

  async syncUserBanner(userId: number) {
    await shopRepository.syncUserBanner(userId);
    await this.rankingService.invalidateCache();
  }
}
