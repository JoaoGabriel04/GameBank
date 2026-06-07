import { MercadoPagoConfig, Payment, Preference } from "mercadopago"

let mpClient: MercadoPagoConfig | null = null

export function getMPClient(): MercadoPagoConfig {
  if (mpClient) return mpClient

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN não configurada")

  mpClient = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 5000 },
  })

  return mpClient
}

export function getMPPayment() {
  return new Payment(getMPClient())
}

export function getMPPreference() {
  return new Preference(getMPClient())
}

export function getWebhookSecret(): string {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) throw new Error("MP_WEBHOOK_SECRET não configurada")
  return secret
}
