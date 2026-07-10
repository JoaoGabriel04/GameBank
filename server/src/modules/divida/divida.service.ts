import { DividaRepository } from "./divida.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";

export class DividaService {
  constructor(private repo = new DividaRepository()) {}

  async listarPendentes(sessionId: number, playerId: number) {
    return this.repo.findPendentesByPlayer(sessionId, playerId);
  }

  async pagarDivida(debtId: number, playerId: number) {
    const debt = await this.repo.findById(debtId);
    if (!debt) throw new AppError(404, "Dívida não encontrada!");
    if (debt.playerId !== playerId) throw new AppError(403, "Esta dívida não pertence a você!");
    if (debt.pago) throw new AppError(400, "Dívida já foi paga!");

    const player = await prisma.sessionPlayer.findUnique({ where: { id: playerId } });
    if (!player) throw new AppError(404, "Jogador não encontrado!");
    if (player.saldo < debt.valor) throw new AppError(400, "Saldo insuficiente para pagar esta dívida!");

    await prisma.$transaction([
      prisma.sessionPlayer.update({
        where: { id: playerId },
        data: { saldo: { decrement: debt.valor } },
      }),
      prisma.debt.update({
        where: { id: debtId },
        data: { pago: true, paidAt: new Date() },
      }),
      prisma.historico.create({
        data: {
          sessionId: debt.sessionId,
          data: new Date(),
          tipo: "DIVIDA",
          detalhes: `${player.nome} pagou R$ ${debt.valor} de dívida: ${debt.descricao}.`,
        },
      }),
    ]);

    // Modo Tabuleiro: quitar a última dívida pendente zera o contador de
    // falência. Campo não é usado pelo Modo Banca — reset é inofensivo lá.
    const aindaDeve = await prisma.debt.findFirst({ where: { playerId, pago: false } });
    if (!aindaDeve) {
      await prisma.sessionPlayer.update({ where: { id: playerId }, data: { rodadasDevendo: 0 } });
    }

    return { message: `Dívida de R$ ${debt.valor} paga com sucesso!` };
  }
}
