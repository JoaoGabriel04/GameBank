/**
 * Remove todos os usuários e dados de partidas/sessões vinculados.
 * Mantém catálogo: propriedades, posses base, missões e itens da loja.
 *
 * Uso: npx tsx scripts/purge-users.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

/** Ordem respeitando FKs (filhos antes dos pais). */
const TABLES_TO_PURGE = [
  "negociacao_itens",
  "negociacoes",
  "notifications",
  "messages",
  "dividas",
  "historico",
  "SessionPosses",
  "session_players",
  "session_teams",
  "sessions",
  "usuario_missoes",
  "usuario_itens",
  "resultados_partidas",
  "users",
] as const;

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function countTable(table: string): Promise<number | null> {
  if (!(await tableExists(table))) return null;
  const quoted = table === table.toLowerCase() ? table : `"${table}"`;
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM ${quoted}`
  );
  return Number(rows[0]?.count ?? 0);
}

async function snapshot() {
  const counts: Record<string, number | string> = {};
  for (const table of TABLES_TO_PURGE) {
    const n = await countTable(table);
    counts[table] = n === null ? "(ausente)" : n;
  }
  return counts;
}

async function main() {
  console.log("Antes da limpeza:", await snapshot());

  let deletedTotal = 0;
  for (const table of TABLES_TO_PURGE) {
    if (!(await tableExists(table))) {
      console.log(`  ⊘ ${table} — tabela não existe, pulando`);
      continue;
    }
    const quoted = table === table.toLowerCase() ? table : `"${table}"`;
    const before = await countTable(table);
    await prisma.$executeRawUnsafe(`DELETE FROM ${quoted}`);
    console.log(`  ✓ ${table} — ${before ?? 0} registro(s) removido(s)`);
    deletedTotal += before ?? 0;
  }

  console.log(`\nTotal removido (aprox.): ${deletedTotal}`);
  console.log("Depois da limpeza:", await snapshot());

  const kept = {
    propriedades: await prisma.propriedade.count().catch(() => "?"),
    posses: await prisma.posses.count().catch(() => "?"),
    missoes: (await tableExists("missoes"))
      ? await prisma.mission.count()
      : "(ausente)",
    lojaItens: (await tableExists("loja_itens"))
      ? await prisma.shopItem.count()
      : "(ausente)",
  };
  console.log("Catálogo preservado:", kept);
}

main()
  .catch((err) => {
    console.error("Falha na limpeza:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
