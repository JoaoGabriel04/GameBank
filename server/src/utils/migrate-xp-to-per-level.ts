import { prisma } from "../lib/prisma.js";
import { totalXpForLevels, getLevelFromXp, MAX_LEVEL } from "./level.js";

export async function migrateXpToPerLevel() {
  console.log("[migrate-xp] Iniciando migração de XP cumulativo → XP por nível...");

  const users = await prisma.user.findMany({
    select: { id: true, xp: true, level: true },
  });

  let corrected = 0;
  let migrated = 0;

  for (const user of users) {
    // Primeiro garante que o nível está correto
    const correctLevel = getLevelFromXp(user.xp);
    if (correctLevel !== user.level) {
      await prisma.user.update({
        where: { id: user.id },
        data: { level: correctLevel },
      });
      corrected++;
    }

    // Converte XP cumulativo → XP dentro do nível
    const xpForPreviousLevels = totalXpForLevels(correctLevel);
    const xpInLevel = Math.max(0, user.xp - xpForPreviousLevels);

    if (xpInLevel !== user.xp) {
      await prisma.user.update({
        where: { id: user.id },
        data: { xp: xpInLevel },
      });
      migrated++;
    }
  }

  console.log(`[migrate-xp] Concluído! ${corrected} níveis corrigidos, ${migrated} XP convertidos.`);
}
