import { prisma } from "../../lib/prisma.js";

export const adminRepository = {
  // ShopItems
  findAllItems: () =>
    prisma.shopItem.findMany({
      orderBy: { id: "asc" },
      include: { banner: true, frame: true },
    }),

  findItemById: (id: number) =>
    prisma.shopItem.findUnique({ where: { id } }),

  createItem: (data: {
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
  }) => prisma.shopItem.create({ data: { name: data.name ?? "", ...data } }),

  updateItem: (id: number, data: Partial<{
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
  }>) => prisma.shopItem.update({ where: { id }, data }),

  deleteItem: (id: number) =>
    prisma.shopItem.delete({ where: { id } }),

  // Remove item_id from all users' user_items JSONB array
  removeItemFromAllUsers: async (itemId: number): Promise<number> => {
    const result = await prisma.$executeRaw`
      UPDATE "users" u
      SET "items" = COALESCE((
        SELECT jsonb_agg(item)
        FROM jsonb_array_elements(u.items) item
        WHERE (item->>'item_id')::int != ${itemId}
      ), '[]'::jsonb)
    `;
    return Number(result);
  },

  resetEquippedBannerForUsers: async (itemId: number): Promise<number> => {
    const result = await prisma.$executeRaw`
      UPDATE "users" u
      SET
        "items" = (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN (item->>'item_id')::int = ${itemId}
                THEN jsonb_set(item, '{equipped}', 'false'::jsonb, true)
              WHEN (item->>'item_id')::int = 0
                THEN jsonb_set(item, '{equipped}', 'true'::jsonb, true)
              ELSE item
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(u.items) item
        ),
        "banner" = NULL
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(u.items) item
        WHERE (item->>'item_id')::int = ${itemId}
          AND (item->>'equipped')::boolean = true
      )
    `;
    return Number(result);
  },

  // Sessions
  findAllSessions: () =>
    prisma.session.findMany({
      where: { status: { in: ["Esperando", "Em Andamento"] } },
      select: {
        id: true,
        nome: true,
        modo: true,
        status: true,
        maxJogadores: true,
        saldoInicial: true,
        dataInicio: true,
        ownerId: true,
        senha: true,
        _count: { select: { jogadores: true } },
      },
      orderBy: { id: "desc" },
    }),

  // Users
  findAllUsers: () =>
    prisma.user.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        level: true,
        xp: true,
        coins: true,
        diamonds: true,
        isAdmin: true,
        avatarUrl: true,
        avatarUpdatedAt: true,
        totalGames: true,
        totalWins: true,
        createdAt: true,
      },
    }),

  updateUserCoins: (id: number, delta: number) =>
    prisma.user.update({
      where: { id },
      data: { coins: { increment: delta } },
      select: { id: true, nome: true, coins: true },
    }),

  updateUserDiamonds: (id: number, delta: number) =>
    prisma.user.update({
      where: { id },
      data: { diamonds: { increment: delta } },
      select: { id: true, nome: true, diamonds: true },
    }),

  updateUserXp: (id: number, delta: number) =>
    prisma.user.update({
      where: { id },
      data: { xp: { increment: delta } },
      select: { id: true, nome: true, xp: true, level: true },
    }),

  // Cards
  findAllCards: () =>
    prisma.card.findMany({ orderBy: { id: "asc" } }),

  findCardById: (id: number) =>
    prisma.card.findUnique({ where: { id } }),

  createCard: (data: {
    tipo: string;
    texto: string;
    efeito: string;
    valor: number;
    ativo: boolean;
  }) => prisma.card.create({ data }),

  updateCard: (id: number, data: Partial<{
    tipo: string;
    texto: string;
    efeito: string;
    valor: number;
    ativo: boolean;
  }>) => prisma.card.update({ where: { id }, data }),

  deleteCard: (id: number) =>
    prisma.card.delete({ where: { id } }),

  // GameSettings
  findAllSettings: () =>
    prisma.gameSettings.findMany(),

  findSettingByKey: (key: string) =>
    prisma.gameSettings.findUnique({ where: { key } }),

  updateSetting: (key: string, value: string) =>
    prisma.gameSettings.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    }),

  updateSettingsBatch: async (settings: Record<string, string>) => {
    const updates = Object.entries(settings).map(([key, value]) =>
      prisma.gameSettings.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    );
    await prisma.$transaction(updates);
  },

  // Banners
  findAllBanners: () =>
    prisma.banner.findMany({ orderBy: { id: "asc" } }),

  findBannerById: (id: number) =>
    prisma.banner.findUnique({ where: { id } }),

  createBanner: (data: {
    nome: string;
    css: string;
    animated: boolean;
    disponibilidade: boolean;
  }) => prisma.banner.create({ data }),

  updateBanner: (id: number, data: Partial<{
    nome: string;
    css: string;
    animated: boolean;
    disponibilidade: boolean;
  }>) => prisma.banner.update({ where: { id }, data }),

  deleteBanner: (id: number) =>
    prisma.banner.delete({ where: { id } }),

  // Frames
  findAllFrames: () =>
    prisma.frame.findMany({ orderBy: { id: "asc" } }),

  findFrameById: (id: number) =>
    prisma.frame.findUnique({ where: { id } }),

  createFrame: (data: {
    nome: string;
    css: string;
    animated: boolean;
    disponibilidade: boolean;
    tipo?: string;
    scale?: number;
  }) => prisma.frame.create({ data }),

  updateFrame: (id: number, data: Partial<{
    nome: string;
    css: string;
    animated: boolean;
    disponibilidade: boolean;
    imagePublicId: string | null;
    scale: number;
  }>) => prisma.frame.update({ where: { id }, data }),

  deleteFrame: (id: number) =>
    prisma.frame.delete({ where: { id } }),

  resetEquippedFrameForUsers: async (itemId: number): Promise<number> => {
    const result = await prisma.$executeRaw`
      UPDATE "users" u
      SET
        "items" = (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN (item->>'item_id')::int = ${itemId}
                THEN jsonb_set(item, '{equipped}', 'false'::jsonb, true)
              ELSE item
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(u.items) item
        ),
        "frame" = NULL,
        "frameType" = NULL,
        "frameAnimated" = false
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(u.items) item
        WHERE (item->>'item_id')::int = ${itemId}
          AND (item->>'equipped')::boolean = true
      )
    `;
    return Number(result);
  },

  // AuditLog
  createAuditLog: (data: {
    userId?: number | null;
    action: string;
    target?: string | null;
    metadata?: Record<string, unknown> | null;
    severity?: string;
  }) =>
    prisma.auditLog.create({
      data: {
        ...(data.userId !== null && data.userId !== undefined ? { userId: data.userId } : {}),
        action: data.action,
        ...(data.target !== null && data.target !== undefined ? { target: data.target } : {}),
        ...(data.metadata !== null && data.metadata !== undefined ? { metadata: data.metadata as any } : {}),
        ...(data.severity ? { severity: data.severity } : {}),
      },
    }),

  listAuditLogs: (opts: {
    userId?: number;
    action?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }) =>
    prisma.auditLog.findMany({
      where: {
        ...(opts.userId !== undefined ? { userId: opts.userId } : {}),
        ...(opts.action ? { action: opts.action } : {}),
        ...(opts.severity ? { severity: opts.severity } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
      include: { user: { select: { id: true, nome: true, email: true } } },
    }),

  // Sessions — extra
  findSessionById: (id: number) =>
    prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        modo: true,
        status: true,
        maxJogadores: true,
        saldoInicial: true,
        dataInicio: true,
        ownerId: true,
        senha: true,
        jogadores: {
          select: {
            id: true,
            nome: true,
            cor: true,
            saldo: true,
            carta_prisao: true,
            desistiu: true,
            userId: true,
            user: { select: { nome: true, avatarUrl: true, avatarUpdatedAt: true } },
          },
        },
      },
    }),

  endSession: (id: number) =>
    prisma.session.update({
      where: { id },
      data: { status: "Finalizada" },
      select: {
        id: true,
        nome: true,
        modo: true,
        status: true,
        maxJogadores: true,
        saldoInicial: true,
        dataInicio: true,
        ownerId: true,
      },
    }),

  adjustPlayerBalance: (playerId: number, delta: number) =>
    prisma.sessionPlayer.update({
      where: { id: playerId },
      data: { saldo: { increment: delta } },
      select: { id: true, nome: true, cor: true, saldo: true, sessionId: true },
    }),

  // Users — extra
  findUserById: (id: number) =>
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        isAdmin: true,
        banned: true,
        bannedAt: true,
        banReason: true,
        level: true,
      },
    }),

  setUserBanned: (id: number, banned: boolean, reason?: string) =>
    prisma.user.update({
      where: { id },
      data: {
        banned,
        bannedAt: banned ? new Date() : null,
        banReason: banned ? reason ?? null : null,
      },
      select: { id: true, nome: true, email: true, banned: true, bannedAt: true, banReason: true },
    }),

  setUserAdmin: (id: number, isAdmin: boolean) =>
    prisma.user.update({
      where: { id },
      data: { isAdmin },
      select: { id: true, nome: true, email: true, isAdmin: true },
    }),

  deleteUser: (id: number) =>
    prisma.$transaction(async (tx) => {
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.session.updateMany({ where: { ownerId: id }, data: { ownerId: null } });
      await tx.sessionPlayer.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.userMission.deleteMany({ where: { userId: id } });
      await tx.gameResult.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    }),

};
