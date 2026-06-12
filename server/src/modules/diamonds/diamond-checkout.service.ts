import { v4 as uuidv4 } from "uuid"
import { getMPPreference } from "../../lib/mercadopago.js"
import { diamondsRepository } from "./diamonds.repository.js"
import { buscarPacote, calcularDiamonds } from "./diamond-packages.service.js"

export async function criarCheckout(userId: number, packageId: number) {
  const preference = getMPPreference()

  const pkg = await buscarPacote(packageId)
  const diamondsTotal = calcularDiamonds(pkg)

  const idempotencyKey = uuidv4()

  const clientUrl = process.env.CLIENT_URL
  if (!clientUrl) throw new Error("CLIENT_URL não configurada")

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const response = await preference.create({
    body: {
      date_of_expiration: expiresAt,
      items: [
        {
          id: `pkg_${pkg.id}`,
          title: `GameBank — ${pkg.name}`,
          description: `${diamondsTotal} diamantes`,
          quantity: 1,
          unit_price: pkg.priceInCents / 100,
          currency_id: "BRL",
        },
      ],
      metadata: {
        user_id: userId,
        package_id: packageId,
        diamonds_total: diamondsTotal,
        idempotency_key: idempotencyKey,
      },
      back_urls: {
        success: `${clientUrl}/user/loja`,
        failure: `${clientUrl}/user/loja`,
        pending: `${clientUrl}/user/loja`,
      },
      auto_return: "approved",
      payment_methods: {
        excluded_payment_types: [],
        installments: 1,
      },
      notification_url: `${process.env.SERVER_URL}/webhooks/mercadopago`,
    },
    requestOptions: { idempotencyKey },
  })

  const preferenceId = response.id!
  if (!preferenceId) throw new Error("Falha ao criar preferência MP — sem ID")

  await diamondsRepository.createPurchase({
    userId,
    packageId,
    diamondsGranted: diamondsTotal,
    amountPaidCents: pkg.priceInCents,
    mpPreferenceId: preferenceId,
    mpIdempotencyKey: idempotencyKey,
    status: "PENDING",
  })

  return {
    checkoutUrl: response.init_point ?? "",
    sandboxUrl: response.sandbox_init_point ?? "",
  }
}
