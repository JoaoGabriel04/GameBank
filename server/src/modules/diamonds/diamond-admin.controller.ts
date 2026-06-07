import type { Request, Response } from "express"
import { prisma } from "../../lib/prisma.js"

export const diamondAdminController = {
  createPackage: async (req: Request, res: Response) => {
    try {
      const { name, description, diamonds, priceInCents, bonusPct } = req.body
      if (!name || !diamonds || !priceInCents) {
        return res.status(400).json({ error: "name, diamonds e priceInCents são obrigatórios" })
      }
      const pkg = await prisma.diamondPackage.create({
        data: {
          name,
          description: description ?? "",
          diamonds: Number(diamonds),
          priceInCents: Number(priceInCents),
          bonusPct: Number(bonusPct ?? 0),
        },
      })
      res.status(201).json(pkg)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  },

  listPackages: async (_req: Request, res: Response) => {
    try {
      const packages = await prisma.diamondPackage.findMany({
        orderBy: { priceInCents: "asc" },
      })
      res.json(packages)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  },

  updatePackage: async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id)
      const { active, name, description, diamonds, priceInCents, bonusPct } = req.body
      const pkg = await prisma.diamondPackage.update({
        where: { id },
        data: {
          ...(active !== undefined && { active }),
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(diamonds !== undefined && { diamonds: Number(diamonds) }),
          ...(priceInCents !== undefined && { priceInCents: Number(priceInCents) }),
          ...(bonusPct !== undefined && { bonusPct: Number(bonusPct) }),
        },
      })
      res.json(pkg)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  },

  listPurchases: async (_req: Request, res: Response) => {
    try {
      const purchases = await prisma.diamondPurchase.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, nome: true } },
          package: { select: { name: true } },
        },
      })
      res.json(purchases)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  },
}
