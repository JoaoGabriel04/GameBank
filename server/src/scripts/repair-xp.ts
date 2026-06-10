import { prisma } from "../lib/prisma.js";
import { addXp, xpForLevel, getLevelFromXp, totalXpForLevels, MAX_LEVEL } from "../utils/level.js";

async function repairXp() {
  console.log("[repair-xp] Verificando consistência de XP e nível...");

  const users = await prisma.user.findMany({
    select: { id: true, nome: true, xp: true, level: true },
    orderBy: { id: "asc" },
  });

  let fixedLevelUp = 0;
  let fixedLevelDown = 0;
  let fixedXpCap = 0;
  let errors: string[] = [];

  for (const user of users) {
    try {
      // 1. Check if XP exceeds the threshold for current level (needs level-up)
      if (user.xp >= xpForLevel(user.level) && user.level < MAX_LEVEL) {
        const { xp: newXp, level: newLevel } = addXp(user.xp, user.level, 0);
        await prisma.user.update({
          where: { id: user.id },
          data: { xp: newXp, level: newLevel },
        });
        console.log(
          `  ✓ #${user.id} ${user.nome}: level-up ${user.level}→${newLevel}, XP ${user.xp}→${newXp}`
        );
        fixedLevelUp++;
        continue;
      }

      // 2. Check if level is too high for the total XP (needs level-down)
      const totalXp = totalXpForLevels(user.level) + user.xp;
      const correctLevel = getLevelFromXp(totalXp);
      if (correctLevel < user.level) {
        const xpForPrevLevels = totalXpForLevels(correctLevel);
        const newXp = Math.max(0, totalXp - xpForPrevLevels);
        await prisma.user.update({
          where: { id: user.id },
          data: { xp: newXp, level: correctLevel },
        });
        console.log(
          `  ✓ #${user.id} ${user.nome}: level-down ${user.level}→${correctLevel}, XP ${user.xp}→${newXp}`
        );
        fixedLevelDown++;
      }
    } catch (err) {
      errors.push(`  ✗ #${user.id} ${user.nome}: ${err}`);
    }
  }

  console.log("\n[repair-xp] Resumo:");
  console.log(`  Level-ups corrigidos: ${fixedLevelUp}`);
  console.log(`  Level-downs corrigidos: ${fixedLevelDown}`);
  if (errors.length > 0) {
    console.log(`  Erros: ${errors.length}`);
    errors.forEach((e) => console.log(e));
  }
  console.log("[repair-xp] Concluído!");
}

repairXp()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[repair-xp] Erro fatal:", err);
    process.exit(1);
  });
