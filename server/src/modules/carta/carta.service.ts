import { CartaRepository, carregarBaralho, getNextCardIndex, type CardData } from "./carta.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";

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

  async sortearCarta(sessionId: number, playerId: number): Promise<SorteioResult> {
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
  }

  private async aplicarEfeito(
    sessionId: number,
    player: { id: number; nome: string; saldo: number; carta_prisao?: boolean },
    carta: CardData,
    tipoBaralho: "sorte" | "reves"
  ): Promise<{ effect: string; debtCreated?: boolean; debtValor?: number }> {
    const operacoes: any[] = [];
    let effect = "";
    let debtCreated = false;
    let debtValor = 0;

    switch (carta.tipo) {
      case "ganhar_dinheiro": {
        operacoes.push(
          prisma.sessionPlayer.update({
            where: { id: player.id },
            data: { saldo: { increment: carta.valor } },
          })
        );
        operacoes.push(
          prisma.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} recebeu R$ ${carta.valor} do banco (${tipoBaralho === "sorte" ? "Sorte" : "Revés"}).`,
            },
          })
        );
        effect = `${player.nome} recebeu R$ ${carta.valor} do banco.`;
        break;
      }

      case "perder_dinheiro": {
        if (player.saldo >= carta.valor) {
          operacoes.push(
            prisma.sessionPlayer.update({
              where: { id: player.id },
              data: { saldo: { decrement: carta.valor } },
            })
          );
          effect = `${player.nome} pagou R$ ${carta.valor} ao banco.`;
        } else {
          const pago = player.saldo;
          if (pago > 0) {
            operacoes.push(
              prisma.sessionPlayer.update({
                where: { id: player.id },
                data: { saldo: 0 },
              })
            );
          }
          debtValor = carta.valor - pago;
          operacoes.push(
            prisma.debt.create({
              data: {
                sessionId: Number(sessionId),
                playerId: player.id,
                valor: debtValor,
                descricao: `Pagamento pendente de R$ ${debtValor} ao banco (carta de ${tipoBaralho === "sorte" ? "Sorte" : "Revés"}).`,
              },
            })
          );
          debtCreated = true;
          effect = `${player.nome} pagou R$ ${pago} ao banco e ficou com dívida de R$ ${debtValor}.`;
        }
        operacoes.push(
          prisma.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} pagou R$ ${carta.valor} ao banco (${tipoBaralho === "sorte" ? "Sorte" : "Revés"}).`,
            },
          })
        );
        break;
      }

      case "receber_jogadores": {
        const others = await this.repo.findSessionPlayers(sessionId, player.id);
        let totalRecebido = 0;

        for (const other of others) {
          const pago = Math.min(carta.valor, other.saldo);
          operacoes.push(
            prisma.sessionPlayer.update({
              where: { id: other.id },
              data: { saldo: { decrement: pago } },
            })
          );
          totalRecebido += carta.valor;
        }

        operacoes.push(
          prisma.sessionPlayer.update({
            where: { id: player.id },
            data: { saldo: { increment: totalRecebido } },
          })
        );
        operacoes.push(
          prisma.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} recebeu R$ ${carta.valor} de cada jogador.`,
            },
          })
        );
        effect = `${player.nome} recebeu R$ ${carta.valor} de cada jogador.`;
        break;
      }

      case "pagar_jogadores": {
        const others2 = await this.repo.findSessionPlayers(sessionId, player.id);
        const totalNeeded = carta.valor * others2.length;
        let totalPago = 0;

        if (player.saldo >= totalNeeded) {
          totalPago = totalNeeded;
          for (const other of others2) {
            operacoes.push(
              prisma.sessionPlayer.update({
                where: { id: other.id },
                data: { saldo: { increment: carta.valor } },
              })
            );
          }
          operacoes.push(
            prisma.sessionPlayer.update({
              where: { id: player.id },
              data: { saldo: { decrement: totalNeeded } },
            })
          );
          effect = `${player.nome} pagou R$ ${carta.valor} para cada jogador.`;
        } else {
          totalPago = player.saldo;
          const perPlayer = Math.floor(totalPago / others2.length);
          let resto = totalPago % others2.length;
          for (const other of others2) {
            const valorPago = perPlayer + (resto > 0 ? 1 : 0);
            if (resto > 0) resto--;
            operacoes.push(
              prisma.sessionPlayer.update({
                where: { id: other.id },
                data: { saldo: { increment: valorPago } },
              })
            );
          }
          operacoes.push(
            prisma.sessionPlayer.update({
              where: { id: player.id },
              data: { saldo: 0 },
            })
          );
          debtValor = totalNeeded - totalPago;
          operacoes.push(
            prisma.debt.create({
              data: {
                sessionId: Number(sessionId),
                playerId: player.id,
                valor: debtValor,
                descricao: `Pagamento pendente de R$ ${debtValor} — valor faltante para pagar R$ ${carta.valor} a cada jogador (carta de ${tipoBaralho === "sorte" ? "Sorte" : "Revés"}).`,
              },
            })
          );
          debtCreated = true;
          effect = `${player.nome} pagou R$ ${totalPago} aos jogadores e ficou com dívida de R$ ${debtValor}.`;
        }

        operacoes.push(
          prisma.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} pagou R$ ${carta.valor} para cada jogador.`,
            },
          })
        );
        break;
      }

      case "carta_prisao": {
        if (player.carta_prisao) {
          operacoes.push(
            prisma.sessionPlayer.update({
              where: { id: player.id },
              data: { saldo: { increment: CARTA_PRESA_VALOR } },
            })
          );
          operacoes.push(
            prisma.historico.create({
              data: {
                sessionId: Number(sessionId),
                data: new Date(),
                tipo: "SORTE_REVES",
                detalhes: `${player.nome} já tinha carta "Saia da Prisão" e recebeu R$ ${CARTA_PRESA_VALOR}.`,
              },
            })
          );
          effect = `${player.nome} já tinha uma carta "Saia da Prisão" e recebeu R$ ${CARTA_PRESA_VALOR}.`;
        } else {
          operacoes.push(
            prisma.sessionPlayer.update({
              where: { id: player.id },
              data: { carta_prisao: true },
            })
          );
          operacoes.push(
            prisma.historico.create({
              data: {
                sessionId: Number(sessionId),
                data: new Date(),
                tipo: "SORTE_REVES",
                detalhes: `${player.nome} ganhou uma carta "Saia da Prisão"!`,
              },
            })
          );
          effect = `${player.nome} ganhou uma carta "Saia da Prisão"!`;
        }
        break;
      }

      case "prisao": {
        operacoes.push(
          prisma.historico.create({
            data: {
              sessionId: Number(sessionId),
              data: new Date(),
              tipo: "SORTE_REVES",
              detalhes: `${player.nome} foi preso!`,
            },
          })
        );
        effect = `${player.nome} foi preso! Vá para a prisão.`;
        break;
      }

      default: {
        throw new AppError(400, `Tipo de carta desconhecido: ${carta.tipo}`);
      }
    }

    await prisma.$transaction(operacoes);
    return { effect, ...(debtCreated ? { debtCreated: true, debtValor } : {}) };
  }

  async usarCartaPrisao(sessionId: number, playerId: number): Promise<string> {
    const player = await this.repo.findPlayerById(playerId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");
    if (!player.carta_prisao) {
      throw new AppError(400, "Você não possui uma carta 'Saia da Prisão'!");
    }

    await prisma.$transaction([
      prisma.sessionPlayer.update({
        where: { id: playerId },
        data: { carta_prisao: false },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "CARTA_PRISAO",
          detalhes: `${player.nome} usou a carta "Saia da Prisão".`,
        },
      }),
    ]);

    return `${player.nome} usou a carta "Saia da Prisão".`;
  }
}
