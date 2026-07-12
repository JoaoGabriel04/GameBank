import { prisma } from "../../lib/prisma.js";

export class EmprestimoRepository {
  async findAtivo(sessionId: number, playerId: number) {
    return prisma.emprestimo.findFirst({
      where: { sessionId, playerId, quitado: false },
    });
  }

  async findAtivoPorPropriedade(sessionId: number, playerId: number, propId: number) {
    return prisma.emprestimo.findFirst({
      where: { sessionId, playerId, quitado: false, garantiaPropId: propId },
    });
  }

  async criar(data: {
    sessionId: number;
    playerId: number;
    valorOriginal: number;
    valorDevido: number;
    garantiaPropId: number;
  }) {
    return prisma.emprestimo.create({ data });
  }

  async atualizarDevido(id: number, valorDevido: number) {
    return prisma.emprestimo.update({
      where: { id },
      data: { valorDevido },
    });
  }

  async quitar(id: number) {
    return prisma.emprestimo.update({
      where: { id },
      data: { quitado: true, quitadoEm: new Date() },
    });
  }

  async executarGarantia(id: number) {
    return prisma.emprestimo.update({
      where: { id },
      data: { executado: true, quitado: true, quitadoEm: new Date() },
    });
  }
}
