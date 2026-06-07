import { prisma } from "../../lib/prisma.js"

export async function listarPacotesAtivos() {
  return prisma.diamondPackage.findMany({
    where: { active: true },
    orderBy: { priceInCents: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      diamonds: true,
      bonusPct: true,
      priceInCents: true,
    },
  })
}

export async function buscarPacote(packageId: number) {
  const pkg = await prisma.diamondPackage.findUnique({
    where: { id: packageId, active: true },
  })
  if (!pkg) throw new Error("Pacote não encontrado ou inativo")
  return pkg
}

export function calcularDiamonds(pkg: { diamonds: number; bonusPct: number }): number {
  return Math.floor(pkg.diamonds * (1 + pkg.bonusPct / 100))
}
