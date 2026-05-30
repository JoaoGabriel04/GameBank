import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error-handler.middleware.js";

export class ShopService {
  async listItems() {
    return prisma.shopItem.findMany({ where: { available: true } });
  }

  async buyItem(userId: number, itemId: number) {
    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item || !item.available) throw new AppError(404, "Item não encontrado");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, "Usuário não encontrado");

    const alreadyOwns = await prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });
    if (alreadyOwns) throw new AppError(400, "Você já possui este item");

    if (user.coins < item.price) throw new AppError(400, "Coins insuficientes");

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { coins: { decrement: item.price } } });
      await tx.userItem.create({ data: { userId, itemId } });
    });

    return { message: "Item comprado com sucesso", item };
  }

  async equipItem(userId: number, itemId: number) {
    const userItem = await prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    });
    if (!userItem) throw new AppError(404, "Item não encontrado");

    await prisma.$transaction(async (tx) => {
      await tx.userItem.updateMany({
        where: { userId, item: { type: userItem.item.type }, equipped: true },
        data: { equipped: false },
      });
      await tx.userItem.update({
        where: { userId_itemId: { userId, itemId } },
        data: { equipped: !userItem.equipped },
      });
    });

    return { message: "Item atualizado", equipped: !userItem.equipped };
  }
}
