import { BancoRepository } from "./banco.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { MissionsService } from "../missions/missions.service.js";
import { calcularAluguel } from "../../shared/economia-core.js";

const ALUGUEL_ACAO_MULTIPLICADOR = 500;
const RECEBER_DE_TODOS_VALOR = 500;
const MAX_VALOR = 9999999;

export class BancoService {
  private missionService = new MissionsService();
  constructor(private repo = new BancoRepository()) {}

  async deposito(userId: number, sessionId: number, valor: number) {
    const player = await this.repo.findPlayerById(userId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");
    if (player.desistiu) throw new AppError(400, "Este jogador já saiu da partida.");

    if (valor <= 0) {
      throw new AppError(400, "Valor deve ser maior que zero!");
    }

    if (valor > MAX_VALOR) {
      throw new AppError(400, `Valor máximo permitido é R$ ${MAX_VALOR.toLocaleString("pt-BR")}`);
    }

    await prisma.$transaction([
      prisma.sessionPlayer.update({
        where: { id: userId },
        data: { saldo: { increment: Number(valor) } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "DEPOSITO",
          detalhes: `${player.nome} depositou R$ ${valor}`,
        },
      }),
    ]);
  }

  // Race condition (FIX_RACE_CONDITION_SALDO): a checagem de saldo e o
  // decremento viram UMA operação atômica no banco (`updateMany` com a
  // condição no WHERE) — duas requisições concorrentes disputam a mesma
  // linha no Postgres, a segunda vê o saldo já decrementado pela primeira
  // e falha corretamente, sem precisar de withLock/Redis.
  async saque(userId: number, sessionId: number, valor: number) {
    if (valor <= 0) {
      throw new AppError(400, "Valor deve ser maior que zero!");
    }
    if (valor > MAX_VALOR) {
      throw new AppError(400, `Valor máximo permitido é R$ ${MAX_VALOR.toLocaleString("pt-BR")}`);
    }

    return prisma.$transaction(async (tx) => {
      const player = await tx.sessionPlayer.findUnique({ where: { id: userId } });
      if (!player) throw new AppError(404, "Jogador não encontrado!");
      if (player.desistiu) throw new AppError(400, "Este jogador já saiu da partida.");

      const debitado = await tx.sessionPlayer.updateMany({
        where: { id: userId, saldo: { gte: valor } },
        data: { saldo: { decrement: Number(valor) } },
      });
      if (debitado.count === 0) {
        throw new AppError(400, "Saldo insuficiente!");
      }

      await tx.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "SAQUE",
          detalhes: `${player.nome} retirou R$ ${valor}`,
        },
      });
    });
  }

  async transferencia(pagadorId: number, recebedorId: number, sessionId: number, valor: number) {
    if (valor <= 0) {
      throw new AppError(400, "Valor deve ser maior que zero!");
    }
    if (valor > MAX_VALOR) {
      throw new AppError(400, `Valor máximo permitido é R$ ${MAX_VALOR.toLocaleString("pt-BR")}`);
    }

    return prisma.$transaction(async (tx) => {
      const pagador = await tx.sessionPlayer.findUnique({ where: { id: pagadorId } });
      if (!pagador) throw new AppError(404, "Jogador pagador não encontrado!");
      if (pagador.desistiu) throw new AppError(400, "Este jogador já saiu da partida.");

      const recebedor = await tx.sessionPlayer.findUnique({ where: { id: recebedorId } });
      if (!recebedor) throw new AppError(404, "Jogador recebedor não encontrado!");
      if (recebedor.desistiu) throw new AppError(400, "O jogador destinatário já saiu da partida.");

      const debitado = await tx.sessionPlayer.updateMany({
        where: { id: pagadorId, saldo: { gte: valor } },
        data: { saldo: { decrement: Number(valor) } },
      });
      if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente para transferência!");

      await tx.sessionPlayer.update({
        where: { id: recebedorId },
        data: { saldo: { increment: Number(valor) } },
      });

      await tx.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "TRANSFERENCIA",
          detalhes: `${pagador.nome} transferiu R$ ${valor} para ${recebedor.nome}`,
        },
      });

      return {
        pagadorNome: pagador.nome,
        recebedorNome: recebedor.nome,
        recebedorId: recebedor.id,
        recebedorUserId: recebedor.userId,
        valor,
      };
    });
  }

  async pagarAluguel(sessionId: number, pagadorId: number, sessionPossesId: number) {
    const result = await prisma.$transaction(async (tx) => {
      const poss = await tx.sessionPosses.findUnique({
        where: { id: sessionPossesId },
        include: { propriedade: true, player: true },
      });
      if (!poss) throw new AppError(404, "Posse não encontrada");
      if (!poss.player) throw new AppError(400, "Propriedade sem dono");
      if (poss.player.id === pagadorId) throw new AppError(400, "Você já é o proprietário");

      const pagador = await tx.sessionPlayer.findUnique({ where: { id: pagadorId } });
      if (!pagador) throw new AppError(404, "Pagador não encontrado");
      if (pagador.desistiu) throw new AppError(400, "Este jogador já saiu da partida.");

      const prop = poss.propriedade;
      if (!prop) throw new AppError(500, "Dados da propriedade indisponíveis");

      const casas = Number(poss.casas ?? 0);
      const valorAluguel = calcularAluguel(prop, casas);

      const debitado = await tx.sessionPlayer.updateMany({
        where: { id: pagadorId, saldo: { gte: valorAluguel } },
        data: { saldo: { decrement: valorAluguel } },
      });
      if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente");

      await tx.sessionPlayer.update({
        where: { id: poss.player.id },
        data: { saldo: { increment: valorAluguel } },
      });

      await tx.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "PAGAMENTO_ALUGUEL",
          detalhes: `${pagador.nome} pagou R$ ${valorAluguel} para ${poss.player.nome} em ${prop.nome}`,
        },
      });

      return { valor: valorAluguel, pagadorNome: pagador.nome, recebedorNome: poss.player.nome, recebedorId: poss.player.id, recebedorUserId: poss.player.userId, propriedadeNome: prop.nome };
    });

    if (result.recebedorUserId) {
      try { await this.missionService.track(result.recebedorUserId, "rent_earned", result.valor); } catch {}
    }

    return result;
  }

  async aluguelAcao(sessionId: number, pagadorId: number, sessionPossesId: number, numDados: number) {
    return prisma.$transaction(async (tx) => {
      const poss = await tx.sessionPosses.findUnique({
        where: { id: sessionPossesId },
        include: { propriedade: true, player: true },
      });
      if (!poss) throw new AppError(404, "Posse não encontrada");
      if (!poss.player) throw new AppError(400, "Propriedade sem dono");
      if (poss.player.id === pagadorId) throw new AppError(400, "Você já é o proprietário");

      const pagador = await tx.sessionPlayer.findUnique({ where: { id: pagadorId } });
      if (!pagador) throw new AppError(404, "Pagador não encontrado");
      if (pagador.desistiu) throw new AppError(400, "Este jogador já saiu da partida.");

      const valorAluguel = ALUGUEL_ACAO_MULTIPLICADOR * Number(numDados);

      const debitado = await tx.sessionPlayer.updateMany({
        where: { id: pagadorId, saldo: { gte: valorAluguel } },
        data: { saldo: { decrement: valorAluguel } },
      });
      if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente");

      await tx.sessionPlayer.update({
        where: { id: poss.player.id },
        data: { saldo: { increment: valorAluguel } },
      });

      await tx.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "PAGAMENTO_ALUGUEL",
          detalhes: `${pagador.nome} pagou R$ ${valorAluguel} para ${poss.player.nome} em ${poss.propriedade.nome}`,
        },
      });

      return { pagadorNome: pagador.nome, recebedorNome: poss.player.nome, recebedorId: poss.player.id, recebedorUserId: poss.player.userId, valor: valorAluguel, propriedadeNome: poss.propriedade.nome };
    });
  }

  // Menos crítico (o valor não é escolhido pelo pagador), mas mesma família
  // de corrida: `updateMany` condicional garante que ninguém fica com
  // saldo negativo se já estiver zerado por outra operação concorrente —
  // quem não tem os R$500 simplesmente não contribui (não lança erro,
  // já que "receber de todos" não é um pagamento obrigatório do pagador).
  async receberDeTodos(sessionId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      const player = await tx.sessionPlayer.findUnique({ where: { id: userId } });
      if (!player) throw new AppError(404, "Jogador não encontrado!");
      if (player.desistiu) throw new AppError(400, "Este jogador já saiu da partida.");

      // Jogadores que já saíram não pagam (e não fazem parte da divisão)
      const outrosJogadores = (await tx.sessionPlayer.findMany({ where: { sessionId, id: { not: userId } } }))
        .filter((j) => !j.desistiu);

      let totalRecebido = 0;
      for (const jogador of outrosJogadores) {
        const debitado = await tx.sessionPlayer.updateMany({
          where: { id: jogador.id, saldo: { gte: RECEBER_DE_TODOS_VALOR } },
          data: { saldo: { decrement: RECEBER_DE_TODOS_VALOR } },
        });
        if (debitado.count > 0) totalRecebido += RECEBER_DE_TODOS_VALOR;
      }

      if (totalRecebido > 0) {
        await tx.sessionPlayer.update({
          where: { id: userId },
          data: { saldo: { increment: totalRecebido } },
        });
      }

      await tx.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "RECEBER_DE_TODOS",
          detalhes: `O jogador ${player.nome} recebeu R$ ${RECEBER_DE_TODOS_VALOR} de todos os jogadores, um total de ${totalRecebido}!`,
        },
      });

      return { jogador: player.nome, total: totalRecebido };
    });
  }
}
