import { prisma } from "../../lib/prisma.js"
import { parseUserItems, resolveShopItem, type UserItemRef } from "../shop/shop.repository.js"
import type { Raridade } from "../../../generated/prisma/index.js"

export const bauRepository = {
  findBauByTipo: (tipo: string) =>
    prisma.bau.findUnique({ where: { tipo } }),

  findAllAtivos: () =>
    prisma.bau.findMany({ where: { ativo: true }, orderBy: { id: "asc" } }),

  findUserItems: (userId: number) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { user_items: true },
    }).then(u => parseUserItems(u?.user_items)),

  findItensDisponiveisPorRaridade: async (raridade: Raridade, ownedItemIds: Set<number>) => {
    const items = await prisma.shopItem.findMany({
      where: {
        fragmentavel: true,
        raridade,
        available: true,
        id: { notIn: Array.from(ownedItemIds) },
      },
      include: { banner: true, frame: true, badge: true },
    })
    return items.map(resolveShopItem).map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      value: item.value,
      imageUrl: item.imageUrl,
      raridade: item.raridade,
      fragmentosTotal: item.fragmentosTotal,
      animated: item.animated ?? false,
    }))
  },

  findFragmentoUsuario: (userId: number, itemId: number) =>
    prisma.userFragment.findUnique({
      where: { userId_itemId: { userId, itemId } },
    }),

  upsertFragmento: (userId: number, itemId: number, quantidade: number) =>
    prisma.userFragment.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, quantidade },
      update: { quantidade: { increment: quantidade } },
    }),

  findBauAdquiridos: (userId: number) =>
    prisma.bauAdquirido.findMany({
      where: { userId, openedAt: null },
      orderBy: { createdAt: "desc" },
      include: { bau: { select: { id: true, tipo: true, nome: true } } },
    }),

  findBauAdquiridoById: (id: number) =>
    prisma.bauAdquirido.findUnique({
      where: { id },
      include: { bau: { select: { id: true, tipo: true, nome: true } } },
    }),

  countBauAdquiridosToday: (userId: number) => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return prisma.bauAdquirido.count({
      where: { userId, createdAt: { gte: hoje } },
    })
  },

  createBauAdquirido: (data: {
    userId: number; bauId: number; sessionId?: number; position?: number; unlockAt: Date
  }) => prisma.bauAdquirido.create({ data }),

  updateBauAdquiridoOpened: (id: number) =>
    prisma.bauAdquirido.update({
      where: { id },
      data: { openedAt: new Date() },
    }),

  deleteBauAdquiridoOld: (userId: number) => {
    const limite = new Date(Date.now() - 5 * 60 * 1000)
    return prisma.bauAdquirido.deleteMany({
      where: { userId, openedAt: { not: null, lt: limite } },
    })
  },

  unlockBauAdquiridos: (userId: number) =>
    prisma.bauAdquirido.updateMany({
      where: { userId, status: "BLOQUEADO", unlockAt: { lte: new Date() } },
      data: { status: "PRONTO" },
    }),
}

