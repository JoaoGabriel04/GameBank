import { prisma } from "../../lib/prisma.js";
import { resolveShopItem } from "./shop.repository.js";

export const dailyOffersRepository = {
  findActiveByUser: (userId: number) =>
    prisma.userDailyOffer.findMany({
      where: {
        userId,
        purchased: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        item: { include: { banner: true, frame: true, badge: true } },
      },
    }),

  countActiveByUser: (userId: number) =>
    prisma.userDailyOffer.count({
      where: {
        userId,
        purchased: false,
        expiresAt: { gt: new Date() },
      },
    }),

  createOffer: (
    userId: number,
    itemId: number,
    preco: number,
    quantidade: number,
    expiresAt: Date,
  ) =>
    prisma.userDailyOffer.create({
      data: { userId, itemId, preco, quantidade, expiresAt },
    }),

  findOfferById: (id: number) =>
    prisma.userDailyOffer.findUnique({
      where: { id },
      include: {
        item: { include: { banner: true, frame: true, badge: true } },
      },
    }),

  markPurchased: (id: number) =>
    prisma.userDailyOffer.update({
      where: { id },
      data: { purchased: true },
    }),
};

export function resolveDailyOffer(offer: any) {
  const resolved = resolveShopItem(offer.item);
  return {
    id: offer.id,
    itemId: offer.itemId,
    preco: offer.preco,
    quantidade: offer.quantidade,
    expiresAt: offer.expiresAt,
    purchased: offer.purchased,
    item: resolved,
  };
}
