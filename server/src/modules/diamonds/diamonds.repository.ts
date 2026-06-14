import { prisma } from "../../lib/prisma.js"
import type { PurchaseStatus } from "../../../generated/prisma/index.js"

export const diamondsRepository = {
  findActivePackages: () =>
    prisma.diamondPackage.findMany({
      where: { active: true },
      orderBy: { priceInCents: "asc" },
      select: {
        id: true, name: true, description: true,
        diamonds: true, bonusPct: true, priceInCents: true,
      },
    }),

  findPackageById: (id: number) =>
    prisma.diamondPackage.findUnique({ where: { id, active: true } }),

  createPackage: (data: {
    name: string
    description: string
    diamonds: number
    priceInCents: number
    bonusPct: number
  }) =>
    prisma.diamondPackage.create({ data }),

  updatePackage: (id: number, data: Record<string, unknown>) =>
    prisma.diamondPackage.update({ where: { id }, data }),

  findAllPackages: () =>
    prisma.diamondPackage.findMany({ orderBy: { priceInCents: "asc" } }),

  findPurchases: (take = 50) =>
    prisma.diamondPurchase.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: { select: { id: true, nome: true } },
        package: { select: { name: true } },
      },
    }),

  createPurchase: (data: {
    userId: number
    packageId: number
    diamondsGranted: number
    amountPaidCents: number
    mpPreferenceId: string
    mpIdempotencyKey: string
    status: PurchaseStatus
  }) =>
    prisma.diamondPurchase.create({ data }),

  findPurchaseByPreferenceId: (preferenceId: string) =>
    prisma.diamondPurchase.findFirst({
      where: { mpPreferenceId: preferenceId },
    }),

  updatePurchaseStatus: (preferenceId: string, status: PurchaseStatus) =>
    prisma.diamondPurchase.updateMany({
      where: { mpPreferenceId: preferenceId },
      data: { status },
    }),

  findCompletedPurchase: (mpPaymentId: string, idempotencyKey: string) =>
    prisma.diamondPurchase.findFirst({
      where: {
        OR: [{ mpPaymentId }, { mpIdempotencyKey: idempotencyKey }],
        status: "COMPLETED",
      },
    }),

  markAsFailed: (mpPaymentId: string) =>
    prisma.diamondPurchase.updateMany({
      where: { mpPaymentId, status: "PENDING" },
      data: { status: "FAILED" },
    }),

  findUserDiamonds: (userId: number) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { diamonds: true },
    }),

  findUserPurchases: (userId: number) =>
    prisma.diamondPurchase.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, diamondsGranted: true, amountPaidCents: true,
        paymentMethod: true, createdAt: true,
        package: { select: { name: true } },
      },
    }),
}
