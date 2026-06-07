import { Router } from "express"
import { handleMercadoPagoWebhook } from "../../modules/diamonds/diamond-webhook.service.js"

const router = Router()

router.post("/mercadopago", handleMercadoPagoWebhook)

export { router as webhookRouter }
