import { prisma } from "../lib/prisma.js"
import { BAU_CONFIG } from "../constants/baus.js"
import { logger } from "../lib/logger.js"

export async function seedBaus() {
  for (const config of Object.values(BAU_CONFIG)) {
    await prisma.bau.upsert({
      where: { tipo: config.tipo },
      create: {
        tipo:          config.tipo,
        nome:          config.nome,
        descricao:     config.descricao,
        precoCoins:    config.precoCoins    ?? null,
        precoDiamonds: config.precoDiamonds ?? null,
      },
      update: {
        nome:          config.nome,
        descricao:     config.descricao,
        precoCoins:    config.precoCoins    ?? null,
        precoDiamonds: config.precoDiamonds ?? null,
      },
    })
  }
  logger.info("seed baús garantidos")
}
