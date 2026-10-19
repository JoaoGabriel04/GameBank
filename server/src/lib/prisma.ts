import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"

// Pool do pg (OTIMIZACAO_SISTEMA.md, P1.5). `max` deve caber no limite de
// conexões do banco hospedado (somando todas as instâncias do servidor);
// default 10, o mesmo do pg. Sem connectionTimeoutMillis, uma requisição
// esperando conexão com o pool esgotado esperava para sempre; agora falha
// em 10s com erro logado, o que torna a saturação visível.
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
})

export const prisma = new PrismaClient({ adapter })
