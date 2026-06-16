import { prisma } from "../../lib/prisma.js"
import { DAILY_TEMPLATES, WEEKLY_TEMPLATES, DAILY_COUNT, WEEKLY_COUNT, type MissionTemplate } from "./mission-templates.js"
import type { MissionMetric } from "../../../generated/prisma/index.js"
import { missionLogger } from "../../lib/logger.js"

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildMissionFromTemplate(
  template: MissionTemplate,
  tipo: "daily" | "weekly"
) {
  const target = pickRandom(template.targetOptions)
  const multiplier = tipo === "weekly" ? 3 : 1

  return {
    name: template.nameTemplate,
    description: `${template.description}: ${target}`,
    metric: template.metric,
    target,
    xpReward: template.fixedReward
      ? template.xpBase * multiplier
      : Math.round(template.xpBase * target * multiplier),
    coinReward: template.fixedReward
      ? template.coinBase * multiplier
      : Math.round(template.coinBase * target * multiplier),
    tipo,
  }
}

function getExpiresAt(tipo: "daily" | "weekly"): Date {
  const now = new Date()
  if (tipo === "daily") {
    const tomorrow = new Date(now)
    tomorrow.setUTCHours(3, 0, 0, 0) // 00:00 BRT = 03:00 UTC
    if (tomorrow <= now) tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    return tomorrow
  } else {
    const next = new Date(now)
    const daysUntilMonday = (8 - next.getUTCDay()) % 7 || 7
    next.setUTCDate(next.getUTCDate() + daysUntilMonday)
    next.setUTCHours(3, 0, 0, 0)
    return next
  }
}

export async function gerarMissoesParaUsuario(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) return

  const now = new Date()

  const existingDaily = await prisma.userMission.findMany({
    where: {
      userId,
      mission: { tipo: "daily" },
      expiresAt: { gt: now },
    },
  })

  const existingWeekly = await prisma.userMission.findMany({
    where: {
      userId,
      mission: { tipo: "weekly" },
      expiresAt: { gt: now },
    },
  })

  const toGenerate: { tipo: "daily" | "weekly"; count: number; templates: MissionTemplate[] }[] = []

  if (existingDaily.length < DAILY_COUNT) {
    toGenerate.push({
      tipo: "daily",
      count: DAILY_COUNT - existingDaily.length,
      templates: DAILY_TEMPLATES,
    })
  }

  if (existingWeekly.length < WEEKLY_COUNT) {
    toGenerate.push({
      tipo: "weekly",
      count: WEEKLY_COUNT - existingWeekly.length,
      templates: WEEKLY_TEMPLATES,
    })
  }

  for (const { tipo, count, templates } of toGenerate) {
    const selected = shuffle(templates).slice(0, count)
    const expiresAt = getExpiresAt(tipo)

    for (const template of selected) {
      const missionData = buildMissionFromTemplate(template, tipo)
      const mission = await prisma.mission.create({
        data: { ...missionData, metric: missionData.metric as MissionMetric },
      })
      await prisma.userMission.create({
        data: {
          userId,
          missionId: mission.id,
          progress: 0,
          expiresAt,
        },
      })
    }
  }
}

export async function limparMissoesExpiradas() {
  const now = new Date()

  const seteDiasAtras = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  await prisma.userMission.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now }, claimed: false },
        { expiresAt: { lt: now }, claimed: true, claimedAt: { lt: seteDiasAtras } },
      ],
    },
  })

  await prisma.mission.deleteMany({
    where: {
      tipo: { in: ["daily", "weekly"] },
      userMissions: { none: {} },
    },
  })

  missionLogger.info("limpeza de missões expiradas concluída")
}
