import crypto from "crypto"
import { getMPPayment, getWebhookSecret } from "../../lib/mercadopago.js"
import { prisma } from "../../lib/prisma.js"
import type { Request, Response } from "express"

function verificarAssinatura(req: Request): boolean {
  try {
    const xSignature = req.headers["x-signature"] as string
    const xRequestId = req.headers["x-request-id"] as string
    const dataId = (req.query["data.id"] ?? req.body?.data?.id) as string

    if (!xSignature || !xRequestId || !dataId) return false

    const parts = xSignature.split(",")
    const ts = parts.find(p => p.startsWith("ts="))?.split("=")[1]
    const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1]

    if (!ts || !v1) return false

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

    const expectedSignature = crypto
      .createHmac("sha256", getWebhookSecret())
      .update(manifest)
      .digest("hex")

    return crypto.timingSafeEqual(
      Buffer.from(v1),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

export async function handleMercadoPagoWebhook(req: Request, res: Response) {
  if (!verificarAssinatura(req)) {
    console.error("[webhook-mp] Assinatura inválida")
    return res.status(400).json({ error: "Assinatura inválida" })
  }

  res.status(200).json({ received: true })

  const type = req.query.type ?? req.body?.type
  const dataId = req.query["data.id"] ?? req.body?.data?.id

  if (type !== "payment" || !dataId) return

  try {
    await processarNotificacaoPagamento(String(dataId))
  } catch (err) {
    console.error("[webhook-mp] Erro ao processar pagamento:", dataId, err)
  }
}

async function processarNotificacaoPagamento(mpPaymentId: string) {
  const paymentClient = getMPPayment()

  // Buscar detalhes reais na API do MP — nunca confiar no body do webhook
  const payment = await paymentClient.get({ id: mpPaymentId })

  if (!payment || payment.status !== "approved") {
    if (payment?.status === "rejected") {
      await marcarComoFalhou(mpPaymentId)
    }
    return
  }

  const userId = parseInt(payment.metadata?.user_id ?? "")
  const packageId = parseInt(payment.metadata?.package_id ?? "")
  const diamondsTotal = parseInt(payment.metadata?.diamonds_total ?? "")
  const idempotencyKey = payment.metadata?.idempotency_key as string

  if (!userId || !packageId || !diamondsTotal || !idempotencyKey) {
    console.error("[webhook-mp] Metadata inválida no pagamento:", mpPaymentId)
    return
  }

  // Idempotência — verificar se já processado
  const jaProcessado = await prisma.diamondPurchase.findFirst({
    where: {
      OR: [
        { mpPaymentId },
        { mpIdempotencyKey: idempotencyKey },
      ],
      status: "COMPLETED",
    },
  })

  if (jaProcessado) {
    console.log("[webhook-mp] Pagamento já processado — ignorando:", mpPaymentId)
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { diamonds: { increment: diamondsTotal } },
    })

    const purchase = await tx.diamondPurchase.update({
      where: { mpIdempotencyKey: idempotencyKey },
      data: {
        mpPaymentId,
        paymentMethod: payment.payment_type_id ?? null,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    })

    await tx.diamondTransaction.create({
      data: {
        userId,
        quantidade: diamondsTotal,
        tipo: "COMPRA",
        purchaseId: purchase.id,
        note: `Pacote #${packageId} — MP Payment ${mpPaymentId}`,
      },
    })
  })

  console.log(`[webhook-mp] ${diamondsTotal} diamantes creditados — user ${userId}`)
}

async function marcarComoFalhou(mpPaymentId: string) {
  await prisma.diamondPurchase.updateMany({
    where: { mpPaymentId, status: "PENDING" },
    data: { status: "FAILED" },
  })
}
