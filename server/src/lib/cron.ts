import cron from "node-cron"
import { limparMissoesExpiradas } from "../modules/missions/mission-generator.service.js"
import { logger } from "./logger.js"

export function startCronJobs() {
  // Rodar todo dia à meia-noite (horário de Brasília = 03:00 UTC)
  cron.schedule("0 3 * * *", async () => {
    logger.info("cron limpando missões expiradas")
    await limparMissoesExpiradas()
  })

  logger.info("cron jobs iniciados")
}
