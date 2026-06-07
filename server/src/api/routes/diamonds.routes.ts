import { Router } from "express"
import { authenticate } from "../../middleware/auth.middleware.js"
import { listarPacotesAtivos } from "../../modules/diamonds/diamond-packages.service.js"
import { criarCheckout } from "../../modules/diamonds/diamond-checkout.service.js"
import { prisma } from "../../lib/prisma.js"

const router = Router()

router.get("/packages", async (_req, res) => {
  try {
    const packages = await listarPacotesAtivos()
    res.json(packages)
  } catch {
    res.status(500).json({ error: "Erro ao listar pacotes" })
  }
})

router.post("/checkout", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId
    const { packageId } = req.body

    if (!packageId || typeof packageId !== "number") {
      return res.status(400).json({ error: "packageId inválido" })
    }

    const result = await criarCheckout(userId, packageId)
    res.json(result)
  } catch (err: any) {
    console.error("[diamonds] Erro no checkout:", err)
    res.status(500).json({ error: err.message ?? "Erro ao criar checkout" })
  }
})

router.get("/balance", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { diamonds: true },
  })
  res.json({ diamonds: user?.diamonds ?? 0 })
})

router.get("/history", authenticate, async (req, res) => {
  const purchases = await prisma.diamondPurchase.findMany({
    where: { userId: req.user!.userId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      diamondsGranted: true,
      amountPaidCents: true,
      paymentMethod: true,
      createdAt: true,
      package: { select: { name: true } },
    },
  })
  res.json(purchases)
})

export { router as diamondsRouter }
