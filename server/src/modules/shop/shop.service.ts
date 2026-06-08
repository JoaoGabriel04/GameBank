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
        } else {
          const hasDefault = finalRefs.some((r) => r.item_id === 0);
          if (hasDefault) finalRefs.forEach((r) => { if (r.item_id === 0) r.equipped = true; });
          updateData.user_items = finalRefs;
          updateData.banner = null;
        }
      }

      if (shopItem.type === "frame") {
        if (nextEquipped) {
          const itemWithBanner = await prisma.shopItem.findUnique({
            where: { id: itemId },
            include: { frame: true },
          });
          if (itemWithBanner?.frame) {
            const f = itemWithBanner.frame;
            updateData.frame = f.tipo === "image" ? f.imageUrl : f.css;
            updateData.frameType = f.tipo;
            updateData.frameAnimated = f.animated;
            updateData.frameScale = f.scale;
          }
        } else {
          updateData.frame = null;
          updateData.frameType = null;
          updateData.frameAnimated = false;
          updateData.frameScale = 136;
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
      data: { user_items: updatedRefs as any, banner: null },
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
      }

      if (shopItem.type === "frame" && target.equipped) {
        updateData.frame = null;
        updateData.frameType = null;
        updateData.frameAnimated = false;
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

  // ── Diamond/Coin pack purchases ──────────────────────────────────────────

  private readonly COIN_PACKS: Record<string, { coins: number; price: number }> = {
    c1: { coins: 300,   price: 50   },
    c2: { coins: 800,   price: 120  },
    c3: { coins: 1800,  price: 240  },
    c4: { coins: 4000,  price: 480  },
    c5: { coins: 9000,  price: 950  },
    c6: { coins: 20000, price: 1800 },
  };

  private readonly DIAMOND_PACKS: Record<string, { diamonds: number }> = {
    d1: { diamonds: 80 },
    d2: { diamonds: 200 },
    d3: { diamonds: 500 },
    d4: { diamonds: 1200 },
    d5: { diamonds: 3000 },
    d6: { diamonds: 8000 },
  };

  async buyCoinsWithDiamonds(userId: number, packId: string) {
    const pack = this.COIN_PACKS[packId];
    if (!pack) throw new AppError(400, "Pacote de coins inválido.");

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { diamonds: true },
      });
      if (!user) throw new AppError(404, "Usuário não encontrado");
      if (user.diamonds < pack.price) {
        throw new AppError(400, "Diamantes insuficientes.");
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          diamonds: { decrement: pack.price },
          coins: { increment: pack.coins },
        },
      });

      await tx.diamondTransaction.create({
        data: {
          userId,
          quantidade: -pack.price,
          tipo: "GASTO_LOJA",
        },
      });

      await tx.coinTransaction.create({
        data: {
          userId,
          amount: pack.coins,
          tipo: "LOJA_COMPRA",
        },
      });
    }, { timeout: 15000, maxWait: 10000 });

    return { message: `${pack.coins.toLocaleString("pt-BR")} coins comprados.` };
  }

  async buyDiamonds(userId: number, packId: string) {
    const pack = this.DIAMOND_PACKS[packId];
    if (!pack) throw new AppError(400, "Pacote de diamantes inválido.");

    // Placeholder: in production, integrate Stripe/Pix here.
    // For now, grant diamonds directly (dev/mock mode).
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { diamonds: { increment: pack.diamonds } },
      });

      await tx.diamondTransaction.create({
        data: {
          userId,
          quantidade: pack.diamonds,
          tipo: "COMPRA",
        },
      });
    }, { timeout: 15000, maxWait: 10000 });

    return { message: `${pack.diamonds} 💎 adicionados.` };
  }

  async comprarItemComDiamantes(userId: number, itemId: number) {
    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });

    if (!item) throw new AppError(404, "Item não encontrado");
    if (!item.diamondPrice) throw new AppError(400, "Item não disponível por diamantes");

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { diamonds: true, user_items: true },
      });

      if (!user || user.diamonds < item.diamondPrice!) {
        throw new AppError(400, "Diamantes insuficientes");
      }

      const refs = parseUserItems(user.user_items);
      if (refs.some((r) => r.item_id === itemId)) {
        throw new AppError(400, "Item já possuído");
      }

      const newRef: UserItemRef = {
        item_id: item.id,
        equipped: false,
        acquiredAt: new Date().toISOString(),
      };

      await tx.user.update({
        where: { id: userId },
        data: {
          diamonds: { decrement: item.diamondPrice! },
          user_items: [...refs, newRef] as any,
        },
      });

      await tx.diamondTransaction.create({
        data: {
          userId,
          quantidade: -item.diamondPrice!,
          tipo: "GASTO_LOJA",
          itemId,
        },
      });
    }, { timeout: 15000, maxWait: 10000 });

    await this.rankingService.invalidateCache();
    return { message: "Item comprado com sucesso", item };
  }
}
