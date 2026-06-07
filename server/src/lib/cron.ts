import cron from "node-cron"
import { limparMissoesExpiradas } from "../modules/missions/mission-generator.service.js"

export function startCronJobs() {
  // Rodar todo dia à meia-noite (horário de Brasília = 03:00 UTC)
  cron.schedule("0 3 * * *", async () => {
    console.log("[cron] Limpando missões expiradas...")
    await limparMissoesExpiradas()
  })

  console.log("[cron] Jobs iniciados")
}
