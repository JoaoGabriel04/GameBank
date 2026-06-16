import type { Request, Response } from "express"
import { listarPacotesAtivos } from "./diamond-packages.service.js"
import { criarCheckout } from "./diamond-checkout.service.js"
import { diamondsRepository } from "./diamonds.repository.js"
import { logger } from "../../lib/logger.js";

export const diamondPublicController = {
  listPackages: async (_req: Request, res: Response) => {
    try {
      const packages = await listarPacotesAtivos()
      res.json(packages)
    } catch {
      res.status(500).json({ error: "Erro ao listar pacotes" })
    }
  },

  checkout: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId
      const { packageId } = req.body

      if (!packageId || typeof packageId !== "number") {
        return res.status(400).json({ error: "packageId inválido" })
      }

      const result = await criarCheckout(userId, packageId)
      res.json(result)
    } catch (err: any) {
      logger.error({ err }, "[diamonds] Erro no checkout")
      res.status(500).json({ error: err.message ?? "Erro ao criar checkout" })
    }
  },

  balance: async (req: Request, res: Response) => {
    try {
      const user = await diamondsRepository.findUserDiamonds(req.user!.userId)
      res.json({ diamonds: user?.diamonds ?? 0 })
    } catch {
      res.status(500).json({ error: "Erro ao buscar saldo" })
    }
  },

  history: async (req: Request, res: Response) => {
    try {
      const purchases = await diamondsRepository.findUserPurchases(req.user!.userId)
      res.json(purchases)
    } catch {
      res.status(500).json({ error: "Erro ao buscar histórico" })
    }
  },
}
