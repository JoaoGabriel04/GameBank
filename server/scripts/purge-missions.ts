/**
 * Remove missões diárias/semanais compartilhadas e seus UserMissions,
 * mantendo apenas missions individuais (1 Mission → 1 UserMission).
 *
 * Missões permanentes não são afetadas.
 *
 * Uso: npx tsx scripts/purge-missions.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  console.log("=== Limpeza de missões compartilhadas ===");

  // 1. Encontrar missions daily/weekly com mais de 1 UserMission
  const shared = await prisma.$queryRaw<{ id: number; name: string; count: bigint }[]>`
    SELECT m.id, m.name, COUNT(um.id)::bigint AS count
    FROM missoes m
    JOIN usuario_missoes um ON um."missionId" = m.id
    WHERE m.tipo IN ('daily', 'weekly')
    GROUP BY m.id, m.name
    HAVING COUNT(um.id) > 1
    ORDER BY count DESC
  `;

  console.log(`\nMissões compartilhadas encontradas: ${shared.length}`);
  for (const s of shared) {
    console.log(`  #${s.id} "${s.name}" — ${s.count} UserMissions`);
  }

  // 2. Para cada mission compartilhada, manter apenas 1 UserMission e
  //    criar uma nova Mission para os demais
  for (const s of shared) {
    const userMissions = await prisma.userMission.findMany({
      where: { missionId: s.id },
      orderBy: { id: "asc" },
      include: { mission: true },
    });

    // Manter o primeiro, recriar para os demais
    const [keep, ...rest] = userMissions;

    for (const um of rest) {
      const newMission = await prisma.mission.create({
        data: {
          name: um.mission.name,
          description: um.mission.description,
          metric: um.mission.metric,
          target: um.mission.target,
          xpReward: um.mission.xpReward,
          coinReward: um.mission.coinReward,
          perGame: um.mission.perGame,
          active: true,
          tipo: um.mission.tipo,
        },
      });

      await prisma.userMission.update({
        where: { id: um.id },
        data: { missionId: newMission.id },
      });

      console.log(`  ↻ UserMission #${um.id} → nova Mission #${newMission.id}`);
    }
  }

  // 3. Remover missions daily/weekly sem nenhum UserMission
  const orphanResult = await prisma.mission.deleteMany({
    where: {
      tipo: { in: ["daily", "weekly"] },
      userMissions: { none: {} },
    },
  });
  console.log(`\nMissões órfãs removidas: ${orphanResult.count}`);

  // 4. Estatísticas finais
  const [totalMissions, totalUM, totalPermanent] = await Promise.all([
    prisma.mission.count(),
    prisma.userMission.count(),
    prisma.mission.count({ where: { tipo: "permanent" } }),
  ]);
  console.log(`\nMissões totais: ${totalMissions} (${totalPermanent} permanentes)`);
  console.log(`UserMissions totais: ${totalUM}`);
  console.log("=== Limpeza concluída ===");
}

main()
  .catch((err) => {
    console.error("Falha na limpeza:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
