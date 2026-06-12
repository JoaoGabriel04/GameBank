import { diamondsRepository } from "./diamonds.repository.js"

export async function listarPacotesAtivos() {
  return diamondsRepository.findActivePackages()
}

export async function buscarPacote(packageId: number) {
  const pkg = await diamondsRepository.findPackageById(packageId)
  if (!pkg) throw new Error("Pacote não encontrado ou inativo")
  return pkg
}

export function calcularDiamonds(pkg: { diamonds: number; bonusPct: number }): number {
  return Math.floor(pkg.diamonds * (1 + pkg.bonusPct / 100))
}
