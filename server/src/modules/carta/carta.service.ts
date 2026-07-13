import { CartaRepository, carregarBaralho, getNextCardIndex, type CardData } from "./carta.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { withLock } from "../../middleware/lock.middleware.js";

const CARTA_PRESA_VALOR = 500;

export interface SorteioResult {
  tipoBaralho: "sorte" | "reves";
  carta: CardData;
  effectDescription: string;
  debtCreated?: boolean;
  debtValor?: number;
}

export class CartaService {
  constructor(private repo = new CartaRepository()) {}

  // Race condition (FIX_RACE_CONDITION_SALDO): o valor da carta não é
  // escolhido pelo jogador — o risco real aqui não é "gastar mais do que
  // tem", é chamar o endpoint 2x rápido e sortear/aplicar 2 cartas numa
  // jogada só. `withLock` por jogador serializa isso.
  async sortearCarta(sessionId: number, playerId: number): Promise<SorteioResult> {
    return withLock(`carta:${playerId}`, async () => {
      const player = await this.repo.findPlayerById(playerId);
      if (!player) throw new AppError(404, "Jogador não encontrado!");

      const baralho = carregarBaralho();
      const todosOsBaralhos: { tipo: "sorte" | "reves"; cartas: CardData[] }[] = [
        { tipo: "sorte", cartas: baralho.sorte },
        { tipo: "reves", cartas: baralho.reves },
      ];

      const total = todosOsBaralhos.reduce((acc, b) => acc + b.cartas.length, 0);
      const escolha = getNextCardIndex(sessionId, total);
      let acum = 0;
      let tipoBaralho: "sorte" | "reves" = "sorte";
      let carta: CardData | null = null;

      for (const b of todosOsBaralhos) {
        if (escolha < acum + b.cartas.length) {
          tipoBaralho = b.tipo;
          carta = b.cartas[escolha - acum];
          break;
        }
        acum += b.cartas.length;
      }

      if (!carta) {
        const last = todosOsBaralhos[todosOsBaralhos.length - 1];
        tipoBaralho = last.tipo;
        carta = last.cartas[last.cartas.length - 1];
      }

      const result = await this.aplicarEfeito(
        sessionId,
        player,
        carta,
        tipoBaralho
      );

      return {
        tipoBaralho,
        carta,
        effectDescription: result.effect,
        ...(result.debtCreated ? { debtCreated: true, debtValor: result.debtValor } : {}),
      };
    });
  }

  // Transação interativa (não array-form): `perder_dinheiro` e
  // `pagar_jogadores` precisam de `updateMany` condicional pra o
  // decremento ser atômico com a checagem de saldo — o valor pago
  // continua calculado do mesmo jeito de sempre (`Math.min(carta.valor,
  // saldo)`), a condição no WHERE é só uma proteção contra corrida (ex.:
  // o mesmo jogador sendo debitado por outra operação bem no meio deste
  // efeito), não uma regra de negócio nova.
  private async aplicarEfeito(
    sessionId: number,
    player: { id: number; nome: string; saldo: number; carta_prisao?: boolean },
    carta: CardData,
    tipoBaralho: "sorte" | "reves"
  ): Promise<{ effect: string; debtCreated?: boolean; debtValor?: number }> {
    return prisma.$transaction(async (tx) => {
      let effect = "";
      let debtCreated = false;
      let debtValor = 0;

      switch (carta.tipo) {
        case "ganhar_dinheiro": {
          await tx.sessionPlayer.update({
            where: { id: player.id },
            data: { saldo: { increment: carta.valor } },
          });
          await tx.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} recebeu R$ ${carta.valor} do banco (${tipoBaralho === "sorte" ? "Sorte" : "Revés"}).`,
            },
          });
          effect = `${player.nome} recebeu R$ ${carta.valor} do banco.`;
          break;
        }

        case "perder_dinheiro": {
          if (player.saldo >= carta.valor) {
            const debitado = await tx.sessionPlayer.updateMany({
              where: { id: player.id, saldo: { gte: carta.valor } },
              data: { saldo: { decrement: carta.valor } },
            });
            if (debitado.count === 0) throw new AppError(409, "Saldo mudou no meio da operação — tente novamente.");
            effect = `${player.nome} pagou R$ ${carta.valor} ao banco.`;
          } else {
            const pago = player.saldo;
            if (pago > 0) {
              const debitado = await tx.sessionPlayer.updateMany({
                where: { id: player.id, saldo: { gte: pago } },
                data: { saldo: { decrement: pago } },
              });
              if (debitado.count === 0) throw new AppError(409, "Saldo mudou no meio da operação — tente novamente.");
            }
            debtValor = carta.valor - pago;
            await tx.debt.create({
              data: {
                sessionId: Number(sessionId),
                playerId: player.id,
                valor: debtValor,
                descricao: `Pagamento pendente de R$ ${debtValor} ao banco (carta de ${tipoBaralho === "sorte" ? "Sorte" : "Revés"}).`,
              },
            });
            debtCreated = true;
            effect = `${player.nome} pagou R$ ${pago} ao banco e ficou com dívida de R$ ${debtValor}.`;
          }
          await tx.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} pagou R$ ${carta.valor} ao banco (${tipoBaralho === "sorte" ? "Sorte" : "Revés"}).`,
            },
          });
          break;
        }

        case "receber_jogadores": {
          const others = await this.repo.findSessionPlayers(sessionId, player.id);
          let totalRecebido = 0;

          for (const other of others) {
            const pago = Math.min(carta.valor, other.saldo);
            if (pago > 0) {
              const debitado = await tx.sessionPlayer.updateMany({
                where: { id: other.id, saldo: { gte: pago } },
                data: { saldo: { decrement: pago } },
              });
              totalRecebido += debitado.count > 0 ? pago : 0;
            }
          }

          await tx.sessionPlayer.update({
            where: { id: player.id },
            data: { saldo: { increment: totalRecebido } },
          });
          await tx.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} recebeu R$ ${carta.valor} de cada jogador.`,
            },
          });
          effect = `${player.nome} recebeu R$ ${carta.valor} de cada jogador.`;
          break;
        }

        case "pagar_jogadores": {
          const others2 = await this.repo.findSessionPlayers(sessionId, player.id);
          const totalNeeded = carta.valor * others2.length;
          let totalPago = 0;

          if (player.saldo >= totalNeeded) {
            totalPago = totalNeeded;
            const debitado = await tx.sessionPlayer.updateMany({
              where: { id: player.id, saldo: { gte: totalNeeded } },
              data: { saldo: { decrement: totalNeeded } },
            });
            if (debitado.count === 0) throw new AppError(409, "Saldo mudou no meio da operação — tente novamente.");
            for (const other of others2) {
              await tx.sessionPlayer.update({
                where: { id: other.id },
                data: { saldo: { increment: carta.valor } },
              });
            }
            effect = `${player.nome} pagou R$ ${carta.valor} para cada jogador.`;
          } else {
            totalPago = player.saldo;
            if (totalPago > 0) {
              const debitado = await tx.sessionPlayer.updateMany({
                where: { id: player.id, saldo: { gte: totalPago } },
                data: { saldo: { decrement: totalPago } },
              });
              if (debitado.count === 0) throw new AppError(409, "Saldo mudou no meio da operação — tente novamente.");
            }
            const perPlayer = Math.floor(totalPago / others2.length);
            let resto = totalPago % others2.length;
            for (const other of others2) {
              const valorPago = perPlayer + (resto > 0 ? 1 : 0);
              if (resto > 0) resto--;
              await tx.sessionPlayer.update({
                where: { id: other.id },
                data: { saldo: { increment: valorPago } },
              });
            }
            debtValor = totalNeeded - totalPago;
            await tx.debt.create({
              data: {
                sessionId: Number(sessionId),
                playerId: player.id,
                valor: debtValor,
                descricao: `Pagamento pendente de R$ ${debtValor} — valor faltante para pagar R$ ${carta.valor} a cada jogador (carta de ${tipoBaralho === "sorte" ? "Sorte" : "Revés"}).`,
              },
            });
            debtCreated = true;
            effect = `${player.nome} pagou R$ ${totalPago} aos jogadores e ficou com dívida de R$ ${debtValor}.`;
          }

          await tx.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} pagou R$ ${carta.valor} para cada jogador.`,
            },
          });
          break;
        }

        case "carta_prisao": {
          if (player.carta_prisao) {
            await tx.sessionPlayer.update({
              where: { id: player.id },
              data: { saldo: { increment: CARTA_PRESA_VALOR } },
            });
            await tx.historico.create({
              data: {
                sessionId: Number(sessionId),
                data: new Date(),
                tipo: "SORTE_REVES",
                detalhes: `${player.nome} já tinha carta "Saia da Prisão" e recebeu R$ ${CARTA_PRESA_VALOR}.`,
              },
            });
            effect = `${player.nome} já tinha uma carta "Saia da Prisão" e recebeu R$ ${CARTA_PRESA_VALOR}.`;
          } else {
            await tx.sessionPlayer.update({
              where: { id: player.id },
              data: { carta_prisao: true },
            });
            await tx.historico.create({
              data: {
                sessionId: Number(sessionId),
                data: new Date(),
                tipo: "SORTE_REVES",
                detalhes: `${player.nome} ganhou uma carta "Saia da Prisão"!`,
              },
            });
            effect = `${player.nome} ganhou uma carta "Saia da Prisão"!`;
          }
          break;
        }

        case "prisao": {
          await tx.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} foi preso!`,
            },
          });
          effect = `${player.nome} foi preso! Vá para a prisão.`;
          break;
        }

        default: {
          throw new AppError(400, `Tipo de carta desconhecido: ${carta.tipo}`);
        }
      }

      return { effect, ...(debtCreated ? { debtCreated: true, debtValor } : {}) };
    });
  }

  // Race condition (FIX_RACE_CONDITION_SALDO): usar a mesma carta "Saia da
  // Prisão" duas vezes rápido. `withLock` serializa por jogador, e o
  // `updateMany` condicionado a `carta_prisao: true` garante que só a
  // primeira chamada realmente consome a carta — a segunda vê `count: 0`
  // e recebe um erro claro em vez de consumir uma carta que já não existe.
  async usarCartaPrisao(sessionId: number, playerId: number): Promise<string> {
    return withLock(`carta-prisao:${playerId}`, async () => {
      const player = await this.repo.findPlayerById(playerId);
      if (!player) throw new AppError(404, "Jogador não encontrado!");
      if (!player.carta_prisao) {
        throw new AppError(400, "Você não possui uma carta 'Saia da Prisão'!");
      }

      const usada = await prisma.sessionPlayer.updateMany({
        where: { id: playerId, carta_prisao: true },
        data: { carta_prisao: false },
      });
      if (usada.count === 0) {
        throw new AppError(400, "Você não possui uma carta 'Saia da Prisão'!");
      }

      await prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "CARTA_PRISAO",
          detalhes: `${player.nome} usou a carta "Saia da Prisão".`,
        },
      });

      return `${player.nome} usou a carta "Saia da Prisão".`;
    });
  }
}
