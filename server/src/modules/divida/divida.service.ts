import { DividaRepository } from "./divida.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";

export class DividaService {
  constructor(private repo = new DividaRepository()) {}

  async listarPendentes(sessionId: number, playerId: number) {
    return this.repo.findPendentesByPlayer(sessionId, playerId);
  }

  // Race condition (FIX_RACE_CONDITION_SALDO): duas condições viram
  // `updateMany` atômico dentro da MESMA transação — o saldo do jogador
  // (não pode ficar negativo) E o `debt.pago` (não pode quitar a mesma
  // dívida duas vezes em paralelo). Sem isso, dois cliques rápidos no
  // "pagar" leem `debt.pago === false` antes de qualquer um marcar como
  // pago, e ambos decrementam o saldo pela mesma dívida.
  async pagarDivida(debtId: number, playerId: number) {
    return prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({ where: { id: debtId } });
      if (!debt) throw new AppError(404, "Dívida não encontrada!");
      if (debt.playerId !== playerId) throw new AppError(403, "Esta dívida não pertence a você!");
      if (debt.pago) throw new AppError(400, "Dívida já foi paga!");

      const player = await tx.sessionPlayer.findUnique({ where: { id: playerId } });
      if (!player) throw new AppError(404, "Jogador não encontrado!");

      const debitado = await tx.sessionPlayer.updateMany({
        where: { id: playerId, saldo: { gte: debt.valor } },
        data: { saldo: { decrement: debt.valor } },
      });
      if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente para pagar esta dívida!");

      const quitada = await tx.debt.updateMany({
        where: { id: debtId, pago: false },
        data: { pago: true, paidAt: new Date() },
      });
      if (quitada.count === 0) throw new AppError(400, "Dívida já foi paga!"); // corrida perdida

      await tx.historico.create({
        data: {
          sessionId: debt.sessionId,
          data: new Date(),
          tipo: "DIVIDA",
          detalhes: `${player.nome} pagou R$ ${debt.valor} de dívida: ${debt.descricao}.`,
        },
      });

      // Modo Tabuleiro: quitar a última dívida pendente zera o contador de
      // falência. Campo não é usado pelo Modo Banca — reset é inofensivo lá.
      const aindaDeve = await tx.debt.findFirst({ where: { playerId, pago: false } });
      if (!aindaDeve) {
        await tx.sessionPlayer.update({ where: { id: playerId }, data: { rodadasDevendo: 0 } });
      }

      return { message: `Dívida de R$ ${debt.valor} paga com sucesso!` };
    });
  }
}
