import crypto from "crypto"
import { getMPPayment, getWebhookSecret } from "../../lib/mercadopago.js"
import { prisma } from "../../lib/prisma.js"
import { diamondsRepository } from "./diamonds.repository.js"
import type { Request, Response } from "express"

// Comparação segura que não lança mesmo com buffers de tamanhos diferentes
function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

function verificarAssinatura(req: Request): boolean {
  try {
    const xSignature = req.headers["x-signature"] as string | undefined
    const xRequestId = req.headers["x-request-id"] as string | undefined

    console.log("[webhook-mp] x-signature header:", xSignature)
    console.log("[webhook-mp] x-request-id header:", xRequestId)
    console.log("[webhook-mp] data.id (body):", req.body?.data?.id)
    console.log("[webhook-mp] data.id (query):", req.query["data.id"])

    if (!xSignature) {
      console.error("[webhook-mp] Header x-signature ausente")
      return false
    }

    const parts = xSignature.split(",")
    const ts = parts.find(p => p.startsWith("ts="))?.split("=")[1]
    const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1]

    if (!ts || !v1) {
      console.error("[webhook-mp] x-signature malformado:", xSignature)
      return false
    }

    // data.id pode vir como query param (notification_url) ou no body (webhook do painel)
    const dataIdQuery = req.query["data.id"] as string | undefined
    const dataIdBody  = req.body?.data?.id  as string | undefined
    const dataIds     = [...new Set([dataIdQuery, dataIdBody].filter(Boolean))] as string[]

    if (dataIds.length === 0) {
      console.error("[webhook-mp] data.id ausente — query:", req.query, "body.data:", req.body?.data)
      return false
    }

    const secret = getWebhookSecret()

    for (const dataId of dataIds) {
      // Formato 1: com x-request-id (webhook configurado no painel MP)
      if (xRequestId) {
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
        const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex")
        console.log("[webhook-mp] manifest (com request-id):", manifest)
        console.log("[webhook-mp] expected:", expected)
        console.log("[webhook-mp] received v1:", v1)
        if (safeEqual(v1, expected)) return true
      }

      // Formato 2: sem x-request-id (notificação via notification_url da preferência)
      const manifestAlt = `id:${dataId};ts:${ts};`
      const expectedAlt = crypto.createHmac("sha256", secret).update(manifestAlt).digest("hex")
      console.log("[webhook-mp] manifest (sem request-id):", manifestAlt)
      console.log("[webhook-mp] expected:", expectedAlt)
      console.log("[webhook-mp] received v1:", v1)
      if (safeEqual(v1, expectedAlt)) return true
    }

    console.error(
      "[webhook-mp] Assinatura inválida — x-signature:", xSignature,
      "| x-request-id:", xRequestId ?? "(ausente)",
      "| query:", req.query,
    )
    return false
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
  const jaProcessado = await diamondsRepository.findCompletedPurchase(mpPaymentId, idempotencyKey)

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
  await diamondsRepository.markAsFailed(mpPaymentId)
}
