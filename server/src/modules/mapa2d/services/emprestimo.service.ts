import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../middleware/error-handler.middleware.js";
import { emitToRoom } from "../../../lib/socket.js";
import { mapa2dRepository } from "../mapa2d.repository.js";
import { economiaMapa2DService } from "./economia.service.js";
import {
  CUSTO_POR_SLOT,
  EMPRESTIMO_MAPA2D_LIMITE_PCT,
  MULT_CONSTRUCAO,
  RENDA_BASE_REF,
  SLOTS_CONSTRUCAO,
} from "../../../constants/economiaMapa2D.js";

class EmprestimoMapa2DService {
  /** Empréstimo (EmprestimoMapa) — modelo distinto do Emprestimo do Modo Tabuleiro, não reutilizar. */
  async pegarEmprestimo(sessionId: number, playerId: number, valor: number) {
    const ativo = await mapa2dRepository.findEmprestimoAtivo(sessionId, playerId);
    if (ativo) throw new AppError(400, "Você já tem um empréstimo ativo.");

    const limite = await this.calcularLimiteCredito(sessionId, playerId);
    if (!Number.isInteger(valor) || valor <= 0 || valor > limite) {
      throw new AppError(400, `Limite disponível: R$ ${limite}.`);
    }

    const garantia = await this.escolherGarantia(sessionId, playerId);
    if (!garantia) throw new AppError(400, "Você não tem construções livres para dar como garantia.");

    await prisma.$transaction([
      prisma.sessionPlayer.update({ where: { id: playerId }, data: { saldo: { increment: valor } } }),
      prisma.emprestimoMapa.create({
        data: {
          sessionId,
          playerId,
          valorOriginal: valor,
          valorDevido: valor,
          garantiaSessionTerrenoId: garantia.sessionTerrenoId,
        },
      }),
    ]);

    await mapa2dRepository.criarHistorico(
      sessionId,
      "MAPA2D_EMPRESTIMO_PEGO",
      `Empréstimo de R$ ${valor} concedido, garantia: ${garantia.tipo} em ${garantia.sessionTerrenoId}`
    );

    emitToRoom(sessionId, "mapa2d:emprestimo_pego", { playerId, valor, garantiaSessionTerrenoId: garantia.sessionTerrenoId });

    return { valor, garantia: { sessionTerrenoId: garantia.sessionTerrenoId, tipo: garantia.tipo } };
  }

  async quitarEmprestimo(sessionId: number, playerId: number) {
    const emprestimo = await mapa2dRepository.findEmprestimoAtivo(sessionId, playerId);
    if (!emprestimo) throw new AppError(404, "Você não tem empréstimo ativo.");

    const player = await mapa2dRepository.findPlayer(playerId);
    if (!player) throw new AppError(404, "Jogador não encontrado.");
    if (player.saldo < emprestimo.valorDevido) throw new AppError(400, "Saldo insuficiente para quitar o empréstimo.");

    await prisma.$transaction([
      prisma.sessionPlayer.update({ where: { id: playerId }, data: { saldo: { decrement: emprestimo.valorDevido } } }),
      prisma.emprestimoMapa.update({ where: { id: emprestimo.id }, data: { quitado: true, quitadoEm: new Date() } }),
    ]);

    await mapa2dRepository.criarHistorico(sessionId, "MAPA2D_EMPRESTIMO_QUITADO", `Empréstimo quitado por R$ ${emprestimo.valorDevido}`);

    emitToRoom(sessionId, "mapa2d:emprestimo_quitado", { playerId, valorPago: emprestimo.valorDevido });

    return { quitado: true, valorPago: emprestimo.valorDevido };
  }

  /** Limite = 50% do valor dos terrenos/construções NÃO dados em garantia. */
  private async calcularLimiteCredito(sessionId: number, playerId: number): Promise<number> {
    const terrenos = await mapa2dRepository.findSessionTerrenosComDono(sessionId, playerId);
    const valorLivre = terrenos
      .filter((t) => !t.emprestimoGarantia)
      .reduce(
        (soma, t) => soma + (t.precoPago ?? 0) + (t.construcao ? SLOTS_CONSTRUCAO[t.construcao.tipo] * CUSTO_POR_SLOT : 0),
        0
      );
    return Math.floor(valorLivre * EMPRESTIMO_MAPA2D_LIMITE_PCT);
  }

  /** Garantia = a construção que mais rende (aluguel base no nível atual, sem oscilação de mercado). */
  private async escolherGarantia(sessionId: number, playerId: number) {
    const terrenos = await mapa2dRepository.findSessionTerrenosComDono(sessionId, playerId);
    let melhor: { sessionTerrenoId: number; tipo: string; renda: number } | null = null;
    for (const t of terrenos) {
      if (!t.construcao || t.emprestimoGarantia) continue;
      const rendaBase = RENDA_BASE_REF * t.terreno.multiplicador * MULT_CONSTRUCAO[t.construcao.tipo];
      const renda = economiaMapa2DService.aluguelNoNivel(rendaBase, t.construcao.nivel);
      if (!melhor || renda > melhor.renda) melhor = { sessionTerrenoId: t.id, tipo: t.construcao.tipo, renda };
    }
    return melhor;
  }
}

export const emprestimoMapa2DService = new EmprestimoMapa2DService();
