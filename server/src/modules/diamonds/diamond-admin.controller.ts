import type { Request, Response } from "express"
import { diamondsRepository } from "./diamonds.repository.js"
import { AppError, parseError } from "../../middleware/error-handler.middleware.js"

export const diamondAdminController = {
  createPackage: async (req: Request, res: Response) => {
    try {
      const { name, description, diamonds, priceInCents, bonusPct } = req.body
      if (!name || !diamonds || !priceInCents) {
        throw new AppError(400, "name, diamonds e priceInCents são obrigatórios")
      }
      const pkg = await diamondsRepository.createPackage({
        name,
        description: description ?? "",
        diamonds: Number(diamonds),
        priceInCents: Number(priceInCents),
        bonusPct: Number(bonusPct ?? 0),
      })
      res.status(201).json(pkg)
    } catch (err) { parseError(res, err) }
  },

  listPackages: async (_req: Request, res: Response) => {
    try {
      const packages = await diamondsRepository.findAllPackages()
      res.json(packages)
    } catch (err) { parseError(res, err) }
  },

  updatePackage: async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id)
      const { active, name, description, diamonds, priceInCents, bonusPct } = req.body
      const pkg = await diamondsRepository.updatePackage(id, {
        ...(active !== undefined && { active }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(diamonds !== undefined && { diamonds: Number(diamonds) }),
        ...(priceInCents !== undefined && { priceInCents: Number(priceInCents) }),
        ...(bonusPct !== undefined && { bonusPct: Number(bonusPct) }),
      })
      res.json(pkg)
    } catch (err) { parseError(res, err) }
  },

  listPurchases: async (_req: Request, res: Response) => {
    try {
      const purchases = await diamondsRepository.findPurchases()
      res.json(purchases)
    } catch (err) { parseError(res, err) }
  },
}
