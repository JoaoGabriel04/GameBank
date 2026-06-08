import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../../lib/audit.js";
import { getLevelFromXp } from "../../utils/level.js";
import { adminRepository } from "./admin.repository.js";
import { ShopService } from "../shop/shop.service.js";
import { validateAndProcessBanner } from "../../lib/image-validation.js";
import { uploadBannerToCloudinary, deleteCloudinaryBanner, rollbackBannerUpload } from "../banner/banner-upload.service.js";
import { validateAndProcessBadge } from "../../lib/badge-validation.js";
import { uploadBadgeToCloudinary, deleteCloudinaryBadge, rollbackBadgeUpload } from "../badge/badge-upload.service.js";
import { uploadFrameToCloudinary, deleteCloudinaryFrame, rollbackFrameUpload } from "../frames/frame-upload.service.js";

interface Actor {
  id?: number | null;
  email?: string | null;
}

export class AdminService {
  // ── ShopItems ──────────────────────────────────────────────────────────

  async listItems() {
    const items = await adminRepository.findAllItems();
    return items;
  }

  async createItem(data: {
    name?: string;
    description: string;
    price: number;
    type: string;
    value?: string | null;
    icon?: string | null;
    rarity?: string | null;
    imageUrl?: string | null;
    imagePublicId?: string | null;
    available: boolean;
    animated?: boolean;
    bannerId?: number | null;
    frameId?: number | null;
  }) {
    let payload = { ...data } as any;
    if (data.type === "banner") {
      if (!data.bannerId) throw new AppError(400, "bannerId é obrigatório para itens do tipo banner.");
      const banner = await adminRepository.findBannerById(data.bannerId);
      if (!banner) throw new AppError(404, "Banner não encontrado.");
      if (!banner.disponibilidade) throw new AppError(400, "Banner não está disponível para venda.");
      payload = {
        ...payload,
        name: banner.nome,
        value: banner.css,
      };
    } else if (data.type === "frame") {
      if (!data.frameId) throw new AppError(400, "frameId é obrigatório para itens do tipo frame.");
      const frame = await adminRepository.findFrameById(data.frameId);
      if (!frame) throw new AppError(404, "Frame não encontrado.");
      if (!frame.disponibilidade) throw new AppError(400, "Frame não está disponível para venda.");
      payload = {
        ...payload,
        name: frame.nome,
        value: frame.tipo === "image" ? frame.imageUrl : frame.css,
        animated: frame.animated,
      };
    } else {
      if (!data.name) throw new AppError(400, "name é obrigatório para itens do tipo title/badge.");
      if (data.type === "title" && data.name && !data.value) {
        payload.value = JSON.stringify({ title: data.name });
      }
    }
    return adminRepository.createItem(payload);
  }

  async updateItem(id: number, data: Partial<{
    name: string;
    description: string;
    price: number;
    type: string;
    value: string | null;
    icon: string | null;
    rarity: string | null;
    imageUrl: string | null;
    imagePublicId: string | null;
    available: boolean;
    animated: boolean;
    bannerId: number | null;
    frameId: number | null;
  }>) {
    const exists = await adminRepository.findItemById(id);
    if (!exists) throw new AppError(404, "Item não encontrado.");

    const nextType = data.type ?? exists.type;
    let payload: any = { ...data };

    if (nextType === "banner") {
      const bannerId = data.bannerId ?? exists.bannerId ?? null;
      if (!bannerId) throw new AppError(400, "bannerId é obrigatório para itens do tipo banner.");
      const banner = await adminRepository.findBannerById(bannerId);
      if (!banner) throw new AppError(404, "Banner não encontrado.");
      if (!banner.disponibilidade && data.bannerId !== undefined) {
        throw new AppError(400, "Banner não está disponível para venda.");
      }
      payload = {
        ...payload,
        bannerId,
        frameId: null,
        name: banner.nome,
        value: banner.css,
      };
    } else if (nextType === "frame") {
      const frameId = data.frameId ?? exists.frameId ?? null;
      if (!frameId) throw new AppError(400, "frameId é obrigatório para itens do tipo frame.");
      const frame = await adminRepository.findFrameById(frameId);
      if (!frame) throw new AppError(404, "Frame não encontrado.");
      if (!frame.disponibilidade && data.frameId !== undefined) {
        throw new AppError(400, "Frame não está disponível para venda.");
      }
      payload = {
        ...payload,
        frameId,
        bannerId: null,
        name: frame.nome,
        value: frame.tipo === "image" ? frame.imageUrl : frame.css,
        animated: frame.animated,
      };
    } else if (nextType === "title" || nextType === "badge") {
      payload = { ...payload, bannerId: null, frameId: null };
      if (data.name !== undefined && !data.name) {
        throw new AppError(400, "name não pode ser vazio para itens do tipo title/badge.");
      }
      // Auto-generate value for titles when name changes
      if (nextType === "title" && data.name && data.name !== exists.name && data.value === undefined) {
        payload.value = JSON.stringify({ title: data.name });
      }
    }

    return adminRepository.updateItem(id, payload);
  }

  async toggleItem(id: number) {
    const item = await adminRepository.findItemById(id);
    if (!item) throw new AppError(404, "Item não encontrado.");
    return adminRepository.updateItem(id, { available: !item.available });
  }

  async deleteItem(id: number, actor?: Actor) {
    const exists = await adminRepository.findItemById(id);
    if (!exists) throw new AppError(404, "Item não encontrado.");

    // Cascade: if the item is a banner/frame and a user has it equipped, reset
    let resetCount = 0;
    if (exists.type === "banner") {
      resetCount = await adminRepository.resetEquippedBannerForUsers(id);
    }
    if (exists.type === "frame") {
      resetCount = await adminRepository.resetEquippedFrameForUsers(id);
    }
    // Remove the item from every user's inventory
    const removedCount = await adminRepository.removeItemFromAllUsers(id);

    // Delete Cloudinary image if badge has one
    if (exists.imagePublicId) {
      await deleteCloudinaryBadge(exists.imagePublicId);
    }

    await adminRepository.deleteItem(id);

    await auditLog({
      userId: actor?.id ?? null,
      action: "admin.shopitem.delete",
      target: `shopitem:${id}`,
      metadata: { type: exists.type, usersReset: resetCount, usersCleaned: removedCount, deletedBy: actor?.email ?? null },
      severity: "warn",
    });
  }

  async uploadBadgeImage(id: number, buffer: Buffer, mime: string | undefined, actor?: Actor) {
    const exists = await adminRepository.findItemById(id);
    if (!exists) throw new AppError(404, "Item não encontrado.");
    if (exists.type !== "badge") throw new AppError(400, "Upload de imagem é permitido apenas para itens do tipo badge.");

    const processed = await validateAndProcessBadge(buffer, mime);

    // Delete previous image if exists
    if (exists.imagePublicId) {
      await deleteCloudinaryBadge(exists.imagePublicId);
    }

    const uploaded = await uploadBadgeToCloudinary(id, processed.buffer);

    await adminRepository.updateItem(id, {
      imageUrl: uploaded.url,
      imagePublicId: uploaded.publicId,
    });

    await auditLog({
      userId: actor?.id ?? null,
      action: "admin.shopitem.badge_image",
      target: `shopitem:${id}`,
      metadata: { uploaded: uploaded.publicId, updatedBy: actor?.email ?? null },
      severity: "info",
    });

    return { imageUrl: uploaded.url, imagePublicId: uploaded.publicId };
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

  async getSessionDetail(id: number) {
    const session = await adminRepository.findSessionById(id);
    if (!session) throw new AppError(404, "Sessão não encontrada.");
    const { senha, jogadores, ...rest } = session;
    return {
      ...rest,
      protegida: senha !== null,
      jogadores: jogadores.map((j) => ({
        id: j.id,
        nome: j.nome,
        cor: j.cor,
        saldo: j.saldo,
        cartaPrisao: j.carta_prisao,
        desistiu: j.desistiu,
        userId: j.userId,
        user: j.user,
      })),
    };
  }

  async endSession(id: number, actor: Actor) {
    const session = await adminRepository.findSessionById(id);
    if (!session) throw new AppError(404, "Sessão não encontrada.");
    if (session.status === "Finalizada") {
      throw new AppError(400, "Sessão já está finalizada.");
    }
    const updated = await adminRepository.endSession(id);
    await auditLog({
      userId: actor.id ?? null,
      action: "session.end",
      target: `session:${id}`,
      metadata: { sessionName: session.nome },
      severity: "warn",
    });
    return {
      ...updated,
      protegida: session.senha !== null,
    };
  }

  async adjustPlayerBalance(playerId: number, delta: number, actor: Actor) {
    if (!Number.isFinite(delta) || delta === 0) {
      throw new AppError(400, "Delta deve ser um número não-zero.");
    }
    const player = await prisma.sessionPlayer.findUnique({
      where: { id: playerId },
      select: { id: true, sessionId: true, nome: true },
    });
    if (!player) throw new AppError(404, "Jogador não encontrado.");
    const updated = await adminRepository.adjustPlayerBalance(playerId, delta);
    await auditLog({
      userId: actor.id ?? null,
      action: "session.player.adjust_balance",
      target: `player:${playerId}`,
      metadata: { sessionId: player.sessionId, playerName: player.nome, delta },
      severity: "info",
    });
    return updated;
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

  async toggleMission(id: number, actor: Actor) {
    const mission = await adminRepository.findMissionById(id);
    if (!mission) throw new AppError(404, "Missão não encontrada.");
    const updated = await adminRepository.toggleMissionActive(id, !mission.active);
    await auditLog({
      userId: actor.id ?? null,
      action: "mission.toggle",
      target: `mission:${id}`,
      metadata: { name: mission.name, newState: !mission.active },
      severity: "info",
    });
    return updated;
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

  async adjustCoins(userId: number, delta: number, actor: Actor) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new AppError(400, "Delta de coins deve ser um inteiro não-zero.");
    }
    if (delta > 0 && process.env.NODE_ENV !== "development") {
      throw new AppError(403, "Admin não pode adicionar saldo — apenas subtrair.");
    }
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
      if (!user) throw new AppError(404, "Usuário não encontrado.");
      if (user.coins + delta < 0) {
        throw new AppError(400, `Operação resultaria em saldo negativo (atual: ${user.coins}, delta: ${delta}).`);
      }
      return tx.user.update({
        where: { id: userId },
        data: { coins: { increment: delta } },
        select: { id: true, nome: true, coins: true },
      });
    });
    await auditLog({
      userId: actor.id ?? null,
      action: "user.adjust_coins",
      target: `user:${userId}`,
      metadata: { delta, resultingCoins: result.coins },
      severity: "info",
    });
    return result;
  }

  async adjustDiamonds(userId: number, delta: number, actor: Actor) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new AppError(400, "Delta de diamantes deve ser um inteiro não-zero.");
    }
    if (delta > 0 && process.env.NODE_ENV !== "development") {
      throw new AppError(403, "Admin não pode adicionar diamantes — apenas subtrair.");
    }
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { diamonds: true } });
      if (!user) throw new AppError(404, "Usuário não encontrado.");
      if (user.diamonds + delta < 0) {
        throw new AppError(400, `Operação resultaria em saldo negativo (atual: ${user.diamonds}, delta: ${delta}).`);
      }
      return tx.user.update({
        where: { id: userId },
        data: { diamonds: { increment: delta } },
        select: { id: true, nome: true, diamonds: true },
      });
    });
    await auditLog({
      userId: actor.id ?? null,
      action: "user.adjust_diamonds",
      target: `user:${userId}`,
      metadata: { delta, resultingDiamonds: result.diamonds },
      severity: "info",
    });
    return result;
  }

  async adjustXp(userId: number, delta: number, actor: Actor) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new AppError(400, "Delta de XP deve ser um inteiro não-zero.");
    }
    const result = await adminRepository.updateUserXp(userId, delta);
    // Recalculate level based on new XP
    const newLevel = getLevelFromXp(result.xp);
    const levelChanged = newLevel !== result.level;
    if (levelChanged) {
      await prisma.user.update({
        where: { id: userId },
        data: { level: newLevel },
      });
    }
    const finalResult = { ...result, level: newLevel };
    await auditLog({
      userId: actor.id ?? null,
      action: "user.adjust_xp",
      target: `user:${userId}`,
      metadata: { delta, resultingXp: result.xp, oldLevel: result.level, newLevel },
      severity: "info",
    });
    return finalResult;
  }

  async setLevel(userId: number, level: number, actor: Actor) {
    const user = await adminRepository.findUserById(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado.");
    if (level < 1 || level > 100) {
      throw new AppError(400, "Nível deve estar entre 1 e 100.");
    }
    const result = await prisma.user.update({
      where: { id: userId },
      data: { level },
      select: { id: true, nome: true, xp: true, level: true },
    });
    await auditLog({
      userId: actor.id ?? null,
      action: "user.set_level",
      target: `user:${userId}`,
      metadata: { oldLevel: user.level, newLevel: level },
      severity: "info",
    });
    return result;
  }

  async banUser(userId: number, reason: string | undefined, actor: Actor) {
    const user = await adminRepository.findUserById(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado.");
    if (user.banned) {
      throw new AppError(400, "Usuário já está banido.");
    }
    const updated = await adminRepository.setUserBanned(userId, true, reason);
    await auditLog({
      userId: actor.id ?? null,
      action: "user.ban",
      target: `user:${userId}`,
      metadata: { reason: reason ?? null, email: user.email },
      severity: "danger",
    });
    return updated;
  }

  async unbanUser(userId: number, actor: Actor) {
    const user = await adminRepository.findUserById(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado.");
    if (!user.banned) {
      throw new AppError(400, "Usuário não está banido.");
    }
    const updated = await adminRepository.setUserBanned(userId, false);
    await auditLog({
      userId: actor.id ?? null,
      action: "user.unban",
      target: `user:${userId}`,
      metadata: { email: user.email },
      severity: "success",
    });
    return updated;
  }

  async setUserAdmin(userId: number, isAdmin: boolean, actor: Actor) {
    const user = await adminRepository.findUserById(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado.");
    if (user.isAdmin === isAdmin) {
      throw new AppError(400, `Usuário já está ${isAdmin ? "como" : "sem ser"} admin.`);
    }
    const updated = await adminRepository.setUserAdmin(userId, isAdmin);
    await auditLog({
      userId: actor.id ?? null,
      action: isAdmin ? "user.set_admin" : "user.remove_admin",
      target: `user:${userId}`,
      metadata: { email: user.email },
      severity: "warn",
    });
    return updated;
  }

  async deleteUser(userId: number, actor: Actor) {
    if (actor.id === userId) {
      throw new AppError(400, "Você não pode excluir o próprio usuário.");
    }
    const user = await adminRepository.findUserById(userId);
    if (!user) throw new AppError(404, "Usuário não encontrado.");

    if (user.isAdmin) {
      const remaining = await prisma.user.count({
        where: { isAdmin: true, banned: false, id: { not: userId } },
      });
      if (remaining === 0) {
        throw new AppError(400, "Não é possível excluir o último admin.");
      }
    }

    await adminRepository.deleteUser(userId);
    await auditLog({
      userId: actor.id ?? null,
      action: "user.delete",
      target: `user:${userId}`,
      metadata: { email: user.email, nome: user.nome },
      severity: "danger",
    });
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
    animated: boolean;
    disponibilidade: boolean;
  }) {
    return adminRepository.createBanner(data);
  }

  async updateBanner(id: number, data: Partial<{
    nome: string;
    css: string;
    animated: boolean;
    disponibilidade: boolean;
  }>, actor?: Actor) {
    const exists = await adminRepository.findBannerById(id);
    if (!exists) throw new AppError(404, "Banner não encontrado.");

    const payload: typeof data & { imagePublicId?: string | null; imageUpdatedAt?: Date | null } = { ...data };

    // If css is being updated, decide what happens to the old Cloudinary image
    if (data.css !== undefined) {
      const isUrl = data.css.startsWith("http://") || data.css.startsWith("https://");
      if (!isUrl && exists.imagePublicId) {
        // Admin switched the banner back to a CSS gradient/preset: delete old image
        deleteCloudinaryBanner(exists.imagePublicId).catch((err) =>
          console.error("[banner] Falha ao remover imagem antiga do Cloudinary:", err)
        );
        payload.imagePublicId = null;
        payload.imageUpdatedAt = null;
      } else if (isUrl && !data.css.includes("res.cloudinary.com")) {
        // Admin pasted a non-Cloudinary URL — reject to keep the contract
        throw new AppError(400, "URL deve ser do Cloudinary. Use POST /admin/banners/:id/image para upload.");
      }
    }

    const updated = await adminRepository.updateBanner(id, payload);

    await auditLog({
      userId: actor?.id ?? null,
      action: "admin.banner.update",
      target: `banner:${id}`,
      metadata: { changedFields: Object.keys(data), deletedOldImage: !!(data.css !== undefined && exists.imagePublicId && !(data.css.startsWith("http://") || data.css.startsWith("https://"))), updatedBy: actor?.email ?? null },
      severity: "info",
    });

    return updated;
  }

  async deleteBanner(id: number, actor?: Actor) {
    const exists = await adminRepository.findBannerById(id);
    if (!exists) throw new AppError(404, "Banner não encontrado.");

    // Find all shop items that reference this banner — they need to be cascaded too
    const linkedItems = await prisma.shopItem.findMany({
      where: { bannerId: id },
      select: { id: true, type: true },
    });

    // Cascade each linked shop item to users — junction table cascades automatically
    let totalReset = 0;
    for (const item of linkedItems) {
      if (item.type === "banner") {
        totalReset += await adminRepository.resetEquippedBannerForUsers(item.id);
      }
      await adminRepository.removeItemFromAllUsers(item.id);
      await prisma.shopItem.delete({ where: { id: item.id } });
    }

    // Delete image from Cloudinary (fire-and-forget — don't block on Cloudinary failure)
    if (exists.imagePublicId) {
      deleteCloudinaryBanner(exists.imagePublicId).catch((err) =>
        console.error("[banner] Falha ao deletar imagem do Cloudinary:", err)
      );
    }

    await adminRepository.deleteBanner(id);

    await auditLog({
      userId: actor?.id ?? null,
      action: "admin.banner.delete",
      target: `banner:${id}`,
      metadata: { cascadedItems: linkedItems.length, usersReset: totalReset, deletedBy: actor?.email ?? null },
      severity: "warn",
    });
  }

  async uploadBannerImage(id: number, fileBuffer: Buffer, fileMime: string | undefined, actor?: Actor) {
    const exists = await adminRepository.findBannerById(id);
    if (!exists) throw new AppError(404, "Banner não encontrado.");

    const processed = await validateAndProcessBanner(fileBuffer, fileMime);

    const uploaded = await uploadBannerToCloudinary(id, processed.buffer);
    const oldPublicId = exists.imagePublicId;

    try {
      const updated = await prisma.banner.update({
        where: { id },
        data: {
          css: uploaded.url,
          imagePublicId: uploaded.publicId,
          imageUpdatedAt: new Date(),
        },
        select: { id: true, nome: true, css: true, animated: true, imagePublicId: true, imageUpdatedAt: true, disponibilidade: true, createdAt: true },
      });

      // Delete the old image (fire-and-forget)
      if (oldPublicId && oldPublicId !== uploaded.publicId) {
        deleteCloudinaryBanner(oldPublicId).catch((err) =>
          console.error("[banner] Falha ao deletar imagem antiga do Cloudinary:", err)
        );
      }

      await auditLog({
        userId: actor?.id ?? null,
        action: "admin.banner.upload_image",
        target: `banner:${id}`,
        metadata: { publicId: uploaded.publicId, replacedOld: !!oldPublicId, uploadedBy: actor?.email ?? null },
        severity: "info",
      });

      return updated;
    } catch (err) {
      // Rollback: remove the orphan upload if DB update fails
      await rollbackBannerUpload(uploaded.publicId);
      throw err;
    }
  }

  // ── Frames ───────────────────────────────────────────────────────────

  async listFrames() {
    return adminRepository.findAllFrames();
  }

  async createFrame(data: {
    nome: string;
    css: string;
    animated: boolean;
    disponibilidade: boolean;
    frameScale?: number;
  }) {
    const { frameScale, ...rest } = data;
    return adminRepository.createFrame({
      ...rest,
      scale: frameScale,
    });
  }

  async updateFrame(id: number, data: Partial<{
    nome: string;
    css: string;
    animated: boolean;
    disponibilidade: boolean;
    frameScale?: number;
  }>, actor?: Actor) {
    const exists = await adminRepository.findFrameById(id);
    if (!exists) throw new AppError(404, "Frame não encontrado.");

    const { frameScale, ...rest } = data;
    const payload: (typeof rest) & { imagePublicId?: string | null; scale?: number } = { ...rest };
    if (frameScale !== undefined) payload.scale = frameScale;

    // If css is being updated, handle Cloudinary cleanup
    if (data.css !== undefined) {
      const isUrl = data.css.startsWith("http://") || data.css.startsWith("https://");
      if (!isUrl && exists.imagePublicId) {
        deleteCloudinaryFrame(exists.imagePublicId).catch((err) =>
          console.error("[frame] Falha ao remover imagem antiga do Cloudinary:", err)
        );
        payload.imagePublicId = null;
      } else if (isUrl && !data.css.includes("res.cloudinary.com")) {
        throw new AppError(400, "URL deve ser do Cloudinary. Use POST /admin/frames/:id/image para upload.");
      }
    }

    const updated = await adminRepository.updateFrame(id, payload);

    await auditLog({
      userId: actor?.id ?? null,
      action: "admin.frame.update",
      target: `frame:${id}`,
      metadata: { changedFields: Object.keys(data), updatedBy: actor?.email ?? null },
      severity: "info",
    });

    return updated;
  }

  async deleteFrame(id: number, actor?: Actor) {
    const exists = await adminRepository.findFrameById(id);
    if (!exists) throw new AppError(404, "Frame não encontrado.");

    const linkedItems = await prisma.shopItem.findMany({
      where: { frameId: id },
      select: { id: true, type: true },
    });

    let totalReset = 0;
    for (const item of linkedItems) {
      if (item.type === "frame") {
        totalReset += await adminRepository.resetEquippedFrameForUsers(item.id);
      }
      await adminRepository.removeItemFromAllUsers(item.id);
      await prisma.shopItem.delete({ where: { id: item.id } });
    }

    if (exists.imagePublicId) {
      deleteCloudinaryFrame(exists.imagePublicId).catch((err) =>
        console.error("[frame] Falha ao deletar imagem do Cloudinary:", err)
      );
    }

    await adminRepository.deleteFrame(id);

    await auditLog({
      userId: actor?.id ?? null,
      action: "admin.frame.delete",
      target: `frame:${id}`,
      metadata: { cascadedItems: linkedItems.length, usersReset: totalReset, deletedBy: actor?.email ?? null },
      severity: "warn",
    });
  }

  async uploadFrameImage(id: number, fileBuffer: Buffer, _fileMime: string | undefined, actor?: Actor) {
    const exists = await adminRepository.findFrameById(id);
    if (!exists) throw new AppError(404, "Frame não encontrado.");

    const uploaded = await uploadFrameToCloudinary(id, fileBuffer);
    const oldPublicId = exists.imagePublicId;

    try {
      const updated = await prisma.frame.update({
        where: { id },
        data: {
          imageUrl: uploaded.url,
          imagePublicId: uploaded.publicId,
          css: uploaded.url,
          tipo: "image",
        },
        select: { id: true, nome: true, tipo: true, imageUrl: true, imagePublicId: true, css: true, animated: true, scale: true, disponibilidade: true, createdAt: true },
      });

      if (oldPublicId && oldPublicId !== uploaded.publicId) {
        deleteCloudinaryFrame(oldPublicId).catch((err) =>
          console.error("[frame] Falha ao deletar imagem antiga do Cloudinary:", err)
        );
      }

      await auditLog({
        userId: actor?.id ?? null,
        action: "admin.frame.upload_image",
        target: `frame:${id}`,
        metadata: { publicId: uploaded.publicId, replacedOld: !!oldPublicId, uploadedBy: actor?.email ?? null },
        severity: "info",
      });

      return updated;
    } catch (err) {
      await rollbackFrameUpload(uploaded.publicId);
      throw err;
    }
  }

  async syncUserBanner(userId: number, actor: Actor) {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new AppError(404, "Usuário não encontrado.");
    await new ShopService().syncUserBanner(userId);
    await auditLog({
      userId: actor.id ?? null,
      action: "admin.user.sync_banner",
      target: `user:${userId}`,
      metadata: { syncedBy: actor.email ?? null },
      severity: "info",
    });
    const updated = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nome: true, banner: true },
    });
    return updated;
  }

  // ── Audit Log ──────────────────────────────────────────────────────────

  async listAudit(opts: {
    userId?: number;
    action?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }) {
    const logs = await adminRepository.listAuditLogs({
      userId: opts.userId,
      action: opts.action,
      severity: opts.severity,
      limit: opts.limit,
      offset: opts.offset,
    });
    return logs.map((l) => ({
      id: l.id,
      ts: l.createdAt,
      actorId: l.userId,
      actorNome: l.user?.nome ?? null,
      actorEmail: l.user?.email ?? null,
      action: l.action,
      target: l.target,
      metadata: l.metadata,
      severity: l.severity,
    }));
  }
}
