import { AppError } from "../../middleware/error-handler.middleware.js";
import { adminRepository } from "./admin.repository.js";

export class AdminService {
  // ── ShopItems ──────────────────────────────────────────────────────────

  async listItems() {
    const items = await adminRepository.findAllItems();
    return items.map((item) => ({
      ...item,
      ownerCount: item._count.userItems,
      _count: undefined,
    }));
  }

  async createItem(data: {
    name: string;
    description: string;
    price: number;
    type: string;
    value?: string | null;
    icon?: string | null;
    available: boolean;
  }) {
    return adminRepository.createItem(data);
  }

  async updateItem(id: number, data: Partial<{
    name: string;
    description: string;
    price: number;
    type: string;
    value: string | null;
    icon: string | null;
    available: boolean;
  }>) {
    const exists = await adminRepository.findItemById(id);
    if (!exists) throw new AppError(404, "Item não encontrado.");
    return adminRepository.updateItem(id, data);
  }

  async toggleItem(id: number) {
    const item = await adminRepository.findItemById(id);
    if (!item) throw new AppError(404, "Item não encontrado.");
    return adminRepository.updateItem(id, { available: !item.available });
  }

  async deleteItem(id: number) {
    const exists = await adminRepository.findItemById(id);
    if (!exists) throw new AppError(404, "Item não encontrado.");
    return adminRepository.deleteItem(id);
  }

  // ── Users ──────────────────────────────────────────────────────────────

  async listUsers() {
    return adminRepository.findAllUsers();
  }

  async adjustCoins(userId: number, delta: number) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new AppError(400, "Delta de coins deve ser um inteiro não-zero.");
    }
    return adminRepository.updateUserCoins(userId, delta);
  }
}
