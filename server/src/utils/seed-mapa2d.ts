import type { PrismaClient } from "../../generated/prisma/index.js";
import regioes from "../../data/mapa2d/regioes.json";

function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Popula os 76 terrenos estáticos do mapa (GDD Seção 4) — idempotente via upsert. */
export async function seedMapa2D(prisma: PrismaClient) {
  for (const regiao of regioes) {
    for (let i = 1; i <= regiao.terrenos; i++) {
      const codigo = `${slugify(regiao.nome)}-${String(i).padStart(2, "0")}`;
      const precoBase = Math.round((300 * regiao.multiplicador) / 5) * 5;

      await prisma.terreno.upsert({
        where: { codigo },
        update: {},
        create: {
          codigo,
          regiaoNome: regiao.nome,
          categoria: regiao.categoria as "comum" | "mediana" | "rica",
          multiplicador: regiao.multiplicador,
          slots: 1,
          precoBase,
        },
      });
    }
  }
}
