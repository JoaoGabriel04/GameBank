/**
 * Remove todas as missões permanentes e seus UserMissions.
 *
 * Uso: npx tsx scripts/purge-missions.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  console.log("=== Limpeza de missões permanentes ===");

  // 1. Encontrar missions com tipo = "permanent"
  const permanentMissions = await prisma.mission.findMany({
    where: { tipo: "permanent" },
    select: { id: true, name: true },
  });

  console.log(`Missões permanentes encontradas: ${permanentMissions.length}`);
  for (const m of permanentMissions) {
    console.log(`  #${m.id} "${m.name}"`);
  }

  // 2. Deletar UserMissions dessas missões
  const deletedUM = await prisma.userMission.deleteMany({
    where: { missionId: { in: permanentMissions.map((m) => m.id) } },
  });
  console.log(`\nUserMissions removidas: ${deletedUM.count}`);

  // 3. Deletar as missões permanentes
  const deletedM = await prisma.mission.deleteMany({
    where: { id: { in: permanentMissions.map((m) => m.id) } },
  });
  console.log(`Missões permanentes removidas: ${deletedM.count}`);

  // 4. Estatísticas finais
  const [totalMissions, totalUM] = await Promise.all([
    prisma.mission.count(),
    prisma.userMission.count(),
  ]);
  console.log(`\nMissões totais restantes: ${totalMissions}`);
  console.log(`UserMissions totais restantes: ${totalUM}`);
  console.log("=== Limpeza concluída ===");
}

main()
  .catch((err) => {
    console.error("Falha na limpeza:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
