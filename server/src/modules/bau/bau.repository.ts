import { prisma } from "../../lib/prisma.js"
import { parseUserItems, resolveShopItem, type UserItemRef } from "../shop/shop.repository.js"

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

  findItensDisponiveisPorRaridade: async (raridade: string, ownedItemIds: Set<number>) => {
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

  createAbertura: (data: {
    userId: number
    bauId: number
    coinsGanhos: number
    custoPago: string
    valorPago: number
    itens: { itemId: number; raridade: string; fragmentos: number }[]
  }) => prisma.bauAbertura.create({
    data: {
      userId:      data.userId,
      bauId:       data.bauId,
      coinsGanhos: data.coinsGanhos,
      custoPago:   data.custoPago,
      valorPago:   data.valorPago,
      itens: { create: data.itens },
    },
    include: { itens: true },
  }),

  findHistoricoUsuario: (userId: number) =>
    prisma.bauAbertura.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        bau:   { select: { nome: true, tipo: true } },
        itens: {
          include: {
            item: { select: { name: true, type: true, raridade: true } },
          },
        },
      },
    }),
}

