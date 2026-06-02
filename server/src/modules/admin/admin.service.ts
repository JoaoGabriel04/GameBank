import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
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
    await prisma.$transaction([
      adminRepository.deleteUserItemsByItemId(id),
      adminRepository.deleteItem(id),
    ]);
  }

  // ── Sessions ───────────────────────────────────────────────────────────

  async listSessions() {
    const sessions = await adminRepository.findAllSessions();
    return sessions.map(({ senha, _count, ...rest }) => ({
      ...rest,
      protegida: senha !== null,
      jogadoresCount: _count.jogadores,
    }));
  }

  // ── Missions ───────────────────────────────────────────────────────────

  async listMissions() {
    return adminRepository.findAllMissions();
  }

  async createMission(data: {
    name: string;
    description: string;
    metric: string;
    target: number;
    xpReward: number;
    coinReward: number;
    perGame: boolean;
    active: boolean;
  }) {
    return adminRepository.createMission(data);
  }

  async updateMission(id: number, data: Partial<{
    name: string;
    description: string;
    metric: string;
    target: number;
    xpReward: number;
    coinReward: number;
    perGame: boolean;
    active: boolean;
  }>) {
    const exists = await adminRepository.findMissionById(id);
    if (!exists) throw new AppError(404, "Missão não encontrada.");
    return adminRepository.updateMission(id, data);
  }

  async deleteMission(id: number) {
    const exists = await adminRepository.findMissionById(id);
    if (!exists) throw new AppError(404, "Missão não encontrada.");
    return adminRepository.deleteMission(id);
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

  // ── Cards ──────────────────────────────────────────────────────────────

  async listCards() {
    return adminRepository.findAllCards();
  }

  async createCard(data: {
    tipo: string;
    texto: string;
    efeito: string;
    valor: number;
    ativo: boolean;
  }) {
    return adminRepository.createCard(data);
  }

  async updateCard(id: number, data: Partial<{
    tipo: string;
    texto: string;
    efeito: string;
    valor: number;
    ativo: boolean;
  }>) {
    const exists = await adminRepository.findCardById(id);
    if (!exists) throw new AppError(404, "Carta não encontrada.");
    return adminRepository.updateCard(id, data);
  }

  async deleteCard(id: number) {
    const exists = await adminRepository.findCardById(id);
    if (!exists) throw new AppError(404, "Carta não encontrada.");
    return adminRepository.deleteCard(id);
  }

  // ── GameSettings ───────────────────────────────────────────────────────

  async getSettings() {
    const settings = await adminRepository.findAllSettings();
    const result: Record<string, any> = {};
    for (const s of settings) {
      result[s.key] = isNaN(+s.value) ? s.value : +s.value;
    }
    return result;
  }

  async updateSettings(data: Record<string, any>) {
    const stringified = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    );
    await adminRepository.updateSettingsBatch(stringified);
    return this.getSettings();
  }

  // ── Banners ────────────────────────────────────────────────────────────

  async listBanners() {
    return adminRepository.findAllBanners();
  }

  async createBanner(data: {
    nome: string;
    css: string;
    spriteId?: string;
    disponibilidade: boolean;
  }) {
    return adminRepository.createBanner(data);
  }

  async updateBanner(id: number, data: Partial<{
    nome: string;
    css: string;
    spriteId: string;
    disponibilidade: boolean;
  }>) {
    const exists = await adminRepository.findBannerById(id);
    if (!exists) throw new AppError(404, "Banner não encontrado.");
    return adminRepository.updateBanner(id, data);
  }

  async deleteBanner(id: number) {
    const exists = await adminRepository.findBannerById(id);
    if (!exists) throw new AppError(404, "Banner não encontrado.");
    return adminRepository.deleteBanner(id);
  }
}
