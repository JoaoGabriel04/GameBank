import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../../lib/audit.js";
import { adminRepository } from "./admin.repository.js";

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
    available: boolean;
    bannerId?: number | null;
  }) {
    let payload = { ...data };
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
    } else {
      if (!data.name) throw new AppError(400, "name é obrigatório para itens do tipo title/badge.");
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
    available: boolean;
    bannerId: number | null;
  }>) {
    const exists = await adminRepository.findItemById(id);
    if (!exists) throw new AppError(404, "Item não encontrado.");

    const nextType = data.type ?? exists.type;
    let payload: typeof data = { ...data };

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
        name: banner.nome,
        value: banner.css,
      };
    } else if (data.type === "title" || data.type === "badge") {
      payload = { ...payload, bannerId: null };
      if (data.name !== undefined && !data.name) {
        throw new AppError(400, "name não pode ser vazio para itens do tipo title/badge.");
      }
    }

    return adminRepository.updateItem(id, payload);
  }

  async toggleItem(id: number) {
    const item = await adminRepository.findItemById(id);
    if (!item) throw new AppError(404, "Item não encontrado.");
    return adminRepository.updateItem(id, { available: !item.available });
  }

  async deleteItem(id: number) {
    const exists = await adminRepository.findItemById(id);
    if (!exists) throw new AppError(404, "Item não encontrado.");
    await adminRepository.deleteItem(id);
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
    const result = await adminRepository.updateUserCoins(userId, delta);
    await auditLog({
      userId: actor.id ?? null,
      action: "user.adjust_coins",
      target: `user:${userId}`,
      metadata: { delta, resultingCoins: result.coins },
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
