import { AppError } from "../../middleware/error-handler.middleware.js";
import { shopRepository } from "./shop.repository.js";

export class ShopService {
  async listItems() {
    return shopRepository.findAvailableItems();
  }

  async buyItem(userId: number, itemId: number) {
    const item = await shopRepository.findShopItem(itemId);
    if (!item || !item.available) throw new AppError(404, "Item não encontrado");

    const user = await shopRepository.findUser(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado");

    const alreadyOwns = await shopRepository.findUserItem(userId, itemId);
    if (alreadyOwns) throw new AppError(400, "Você já possui este item");

    if (user.coins < item.price) throw new AppError(400, "Coins insuficientes");

    await shopRepository.purchaseItem(userId, itemId, item.price);

    return { message: "Item comprado com sucesso", item };
  }

  async equipItem(userId: number, itemId: number) {
    const userItem = await shopRepository.findUserItemWithType(userId, itemId);
    if (!userItem) throw new AppError(404, "Item não encontrado");

    await shopRepository.toggleEquip(userId, itemId, userItem.item.type, userItem.equipped);

    return { message: "Item atualizado", equipped: !userItem.equipped };
  }
}
