import crypto from "crypto"
import { getMPPayment, getWebhookSecret } from "../../lib/mercadopago.js"
import { prisma } from "../../lib/prisma.js"
import { diamondsRepository } from "./diamonds.repository.js"
import type { Request, Response } from "express"
import { logger } from "../../lib/logger.js";

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

    logger.info({ xSignature }, "[webhook-mp] x-signature header")
    logger.info({ xRequestId }, "[webhook-mp] x-request-id header")
    logger.info({ dataIdBody: req.body?.data?.id }, "[webhook-mp] data.id (body)")
    logger.info({ dataIdQuery: req.query["data.id"] }, "[webhook-mp] data.id (query)")

    if (!xSignature) {
      logger.error("[webhook-mp] Header x-signature ausente")
      return false
    }

    const parts = xSignature.split(",")
    const ts = parts.find(p => p.startsWith("ts="))?.split("=")[1]
    const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1]

    if (!ts || !v1) {
      logger.error({ xSignature }, "webhook-mp x-signature malformado")
      return false
    }

    // data.id pode vir como query param (notification_url) ou no body (webhook do painel)
    const dataIdQuery = req.query["data.id"] as string | undefined
    const dataIdBody  = req.body?.data?.id  as string | undefined
    const dataIds     = [...new Set([dataIdQuery, dataIdBody].filter(Boolean))] as string[]

    if (dataIds.length === 0) {
      logger.error({ query: req.query, bodyData: req.body?.data }, "webhook-mp data.id ausente")
      return false
    }

    const secret = getWebhookSecret()

    for (const dataId of dataIds) {
      // Formato 1: com x-request-id (webhook configurado no painel MP)
      if (xRequestId) {
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
        const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex")
        logger.info({ manifest }, "[webhook-mp] manifest (com request-id)")
        logger.info({ expected }, "[webhook-mp] expected")
        logger.info({ v1 }, "[webhook-mp] received v1")
        if (safeEqual(v1, expected)) return true
      }

      // Formato 2: sem x-request-id (notificação via notification_url da preferência)
      const manifestAlt = `id:${dataId};ts:${ts};`
      const expectedAlt = crypto.createHmac("sha256", secret).update(manifestAlt).digest("hex")
      logger.info({ manifestAlt }, "[webhook-mp] manifest (sem request-id)")
      logger.info({ expectedAlt }, "[webhook-mp] expected")
      logger.info({ v1 }, "[webhook-mp] received v1")
      if (safeEqual(v1, expectedAlt)) return true
    }

    logger.error(
      { xSignature, xRequestId: xRequestId ?? "(ausente)", query: req.query },
      "webhook-mp assinatura inválida"
    )
    return false
  } catch {
    return false
  }
}

export async function handleMercadoPagoWebhook(req: Request, res: Response) {
  if (!verificarAssinatura(req)) {
    logger.error("[webhook-mp] Assinatura inválida")
    return res.status(400).json({ error: "Assinatura inválida" })
  }

  res.status(200).json({ received: true })

  const type = req.query.type ?? req.body?.type
  const dataId = req.query["data.id"] ?? req.body?.data?.id

  if (type !== "payment" || !dataId) return

  try {
    await processarNotificacaoPagamento(String(dataId))
  } catch (err) {
    logger.error({ err, dataId }, "webhook-mp erro ao processar pagamento")
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
    logger.error({ mpPaymentId }, "webhook-mp metadata inválida no pagamento")
    return
  }

  // Idempotência — verificar se já processado
  const jaProcessado = await diamondsRepository.findCompletedPurchase(mpPaymentId, idempotencyKey)

  if (jaProcessado) {
    logger.info({ mpPaymentId }, "[webhook-mp] Pagamento já processado — ignorando")
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

  logger.info({ diamondsTotal, userId }, "webhook-mp diamantes creditados")
}

async function marcarComoFalhou(mpPaymentId: string) {
  await diamondsRepository.markAsFailed(mpPaymentId)
}
