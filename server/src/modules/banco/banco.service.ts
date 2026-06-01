import { BancoRepository } from "./banco.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { MissionsService } from "../missions/missions.service.js";

const ALUGUEL_ACAO_MULTIPLICADOR = 500;
const RECEBER_DE_TODOS_VALOR = 500;
const MAX_VALOR = 9999999;

export class BancoService {
  private missionService = new MissionsService();
  constructor(private repo = new BancoRepository()) {}

  async deposito(userId: number, sessionId: number, valor: number) {
    const player = await this.repo.findPlayerById(userId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");

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

  async saque(userId: number, sessionId: number, valor: number) {
    const player = await this.repo.findPlayerById(userId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");

    if (valor > MAX_VALOR) {
      throw new AppError(400, `Valor máximo permitido é R$ ${MAX_VALOR.toLocaleString("pt-BR")}`);
    }

    if (player.saldo < valor) {
      throw new AppError(400, "Saldo insuficiente!");
    }

    await prisma.$transaction([
      prisma.sessionPlayer.update({
        where: { id: userId },
        data: { saldo: { decrement: Number(valor) } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "SAQUE",
          detalhes: `${player.nome} retirou R$ ${valor}`,
        },
      }),
    ]);
  }

  async transferencia(pagadorId: number, recebedorId: number, sessionId: number, valor: number) {
    const pagador = await this.repo.findPlayerById(pagadorId);
    if (!pagador) throw new AppError(404, "Jogador pagador não encontrado!");

    if (valor > MAX_VALOR) {
      throw new AppError(400, `Valor máximo permitido é R$ ${MAX_VALOR.toLocaleString("pt-BR")}`);
    }

    const recebedor = await this.repo.findPlayerById(recebedorId);
    if (!recebedor) throw new AppError(404, "Jogador recebedor não encontrado!");

    await prisma.$transaction([
      prisma.sessionPlayer.update({
        where: { id: pagadorId },
        data: { saldo: { decrement: Number(valor) } },
      }),
      prisma.sessionPlayer.update({
        where: { id: recebedorId },
        data: { saldo: { increment: Number(valor) } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "TRANSFERENCIA",
          detalhes: `${pagador.nome} transferiu R$ ${valor} para ${recebedor.nome}`,
        },
      }),
    ]);
  }

  async pagarAluguel(sessionId: number, pagadorId: number, sessionPossesId: number) {
    const poss = await this.repo.findSessionPossesById(sessionPossesId);
    if (!poss) throw new AppError(404, "Posse não encontrada");
    if (!poss.player) throw new AppError(400, "Propriedade sem dono");
    if (poss.player.id === pagadorId) throw new AppError(400, "Você já é o proprietário");

    const pagador = await this.repo.findPlayerById(pagadorId);
    if (!pagador) throw new AppError(404, "Pagador não encontrado");

    const prop = poss.posses.propriedade;
    if (!prop) throw new AppError(500, "Dados da propriedade indisponíveis");

    const casas = Number(poss.casas ?? 0);
    let valorAluguel = 0;

    switch (casas) {
      case 0:
        valorAluguel = prop.aluguel_base ?? 0;
        break;
      case 1:
        valorAluguel = prop.aluguel_1c ?? prop.aluguel_base ?? 0;
        break;
      case 2:
        valorAluguel = prop.aluguel_2c ?? prop.aluguel_1c ?? prop.aluguel_base ?? 0;
        break;
      case 3:
        valorAluguel = prop.aluguel_3c ?? prop.aluguel_2c ?? prop.aluguel_1c ?? prop.aluguel_base ?? 0;
        break;
      case 4:
        valorAluguel = prop.aluguel_4c ?? prop.aluguel_3c ?? prop.aluguel_3c ?? prop.aluguel_base ?? 0;
        break;
      default:
        valorAluguel = prop.aluguel_hotel ?? prop.aluguel_4c ?? prop.aluguel_base ?? 0;
        break;
    }

    if (pagador.saldo < valorAluguel) {
      throw new AppError(400, "Saldo insuficiente");
    }

    await prisma.$transaction([
      prisma.sessionPlayer.update({
        where: { id: pagadorId },
        data: { saldo: { decrement: valorAluguel } },
      }),
      prisma.sessionPlayer.update({
        where: { id: poss.player.id },
        data: { saldo: { increment: valorAluguel } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "PAGAMENTO_ALUGUEL",
          detalhes: `${pagador.nome} pagou R$ ${valorAluguel} para ${poss.player.nome} em ${prop.nome}`,
        },
      }),
    ]);

    if (poss.player.userId) {
      try { await this.missionService.track(poss.player.userId, "rent_earned", valorAluguel); } catch {}
    }

    return { valor: valorAluguel, pagadorNome: pagador.nome, recebedorNome: poss.player.nome, recebedorId: poss.player.id, recebedorUserId: poss.player.userId, propriedadeNome: prop.nome };
  }

  async aluguelAcao(sessionId: number, pagadorId: number, sessionPossesId: number, numDados: number) {
    const poss = await this.repo.findSessionPossesById(sessionPossesId);
    if (!poss) throw new AppError(404, "Posse não encontrada");
    if (!poss.player) throw new AppError(400, "Propriedade sem dono");
    if (poss.player.id === pagadorId) throw new AppError(400, "Você já é o proprietário");

    const pagador = await this.repo.findPlayerById(pagadorId);
    if (!pagador) throw new AppError(404, "Pagador não encontrado");

    const valorAluguel = ALUGUEL_ACAO_MULTIPLICADOR * Number(numDados);

    if (pagador.saldo < valorAluguel) {
      throw new AppError(400, "Saldo insuficiente");
    }

    await prisma.$transaction([
      prisma.sessionPlayer.update({
        where: { id: pagadorId },
        data: { saldo: { decrement: valorAluguel } },
      }),
      prisma.sessionPlayer.update({
        where: { id: poss.player.id },
        data: { saldo: { increment: valorAluguel } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "PAGAMENTO_ALUGUEL",
          detalhes: `${pagador.nome} pagou R$ ${valorAluguel} para ${poss.player.nome} em ${poss.posses.propriedade.nome}`,
        },
      }),
    ]);

    return { pagadorNome: pagador.nome, recebedorNome: poss.player.nome, recebedorId: poss.player.id, recebedorUserId: poss.player.userId, valor: valorAluguel, propriedadeNome: poss.posses.propriedade.nome };
  }

  async receberDeTodos(sessionId: number, userId: number) {
    const player = await this.repo.findPlayerById(userId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");

    const outrosJogadores = await this.repo.findPlayersBySession(sessionId, userId);

    await prisma.$transaction([
      ...outrosJogadores.map((jogador) =>
        prisma.sessionPlayer.update({
          where: { id: jogador.id },
          data: { saldo: { decrement: RECEBER_DE_TODOS_VALOR } },
        })
      ),
      prisma.sessionPlayer.update({
        where: { id: userId },
        data: { saldo: { increment: RECEBER_DE_TODOS_VALOR * outrosJogadores.length } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "RECEBER_DE_TODOS",
          detalhes: `O jogador ${player.nome} recebeu R$ ${RECEBER_DE_TODOS_VALOR} de todos os jogadores, um total de ${RECEBER_DE_TODOS_VALOR * outrosJogadores.length}!`,
        },
      }),
    ]);

    return { jogador: player.nome, total: RECEBER_DE_TODOS_VALOR * outrosJogadores.length };
  }
}
