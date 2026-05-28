import { PropriedadeRepository } from "./propriedade.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { withLock } from "../../middleware/lock.middleware.js";

export class PropriedadeService {
  constructor(private repo = new PropriedadeRepository()) {}

  async getPropById(propriedadeId: number) {
    const prop = await this.repo.findPropriedadeById(propriedadeId);
    if (!prop) throw new AppError(404, "Propriedade não encontrada");
    return prop;
  }

  async buyProp(possesId: number, sessionId: number, userId: number) {
    return withLock(`prop:${possesId}`, async () => {
      const player = await this.repo.findPlayerById(userId);
      if (!player) throw new AppError(404, "Jogador não encontrado");

      const sessionPosses = await this.repo.findSessionPosses(sessionId, possesId);
      if (!sessionPosses) throw new AppError(404, "Propriedade não encontrada nesta sessão");
      if (sessionPosses.playerId) throw new AppError(400, "Propriedade já foi comprada");

      const propriedade = sessionPosses.posses.propriedade;
      if (!propriedade) throw new AppError(404, "Dados da propriedade não encontrados");

      if (player.saldo < propriedade.custo_compra) {
        throw new AppError(400, "Saldo insuficiente");
      }

      const hipotecada = await this.repo.findFirstHipotecada();
      const valorCompra = hipotecada ? propriedade.custo_compra * 1.2 : propriedade.custo_compra;

      await prisma.$transaction([
        prisma.sessionPosses.updateMany({
          where: { sessionId, possesId },
          data: { playerId: userId },
        }),
        prisma.sessionPlayer.update({
          where: { id: userId },
          data: { saldo: { decrement: valorCompra } },
        }),
        prisma.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "COMPRA_PROPRIEDADE",
            detalhes: `${player.nome} comprou a propriedade em ${propriedade.nome} por R$ ${valorCompra}`,
          },
        }),
      ]);

      return this.repo.findSessionPosses(sessionId, possesId);
    });
  }

  async buyHouse(userId: number, sessionId: number, propriedadeId: number) {
    return withLock(`prop:${propriedadeId}`, async () => {
      const propriedade = await this.repo.findSessionPosses(sessionId, propriedadeId);
      if (!propriedade) throw new AppError(404, "Propriedade não encontrada!");

      if (propriedade.negociando) {
        throw new AppError(400, "Esta propriedade está em negociação!");
      }

      const player = await this.repo.findPlayerById(userId);
      if (!player) throw new AppError(404, "Jogador não encontrado!");

      const custoCasa = propriedade.posses.propriedade.custo_casa;
      if (player.saldo < custoCasa) {
        throw new AppError(400, "Saldo insuficiente para comprar uma casa!");
      }

      if (propriedade.casas >= 5) {
        throw new AppError(400, "Esta propriedade já possui o número máximo de casas!");
      }

      await prisma.$transaction([
        prisma.sessionPosses.update({
          where: { id: propriedade.id },
          data: { casas: { increment: 1 } },
        }),
        prisma.sessionPlayer.update({
          where: { id: userId },
          data: { saldo: { decrement: custoCasa } },
        }),
        prisma.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "COMPRA_CASA",
            detalhes: `${player.nome} comprou uma casa em ${propriedade.posses.propriedade.nome} por R$ ${custoCasa}`,
          },
        }),
      ]);
    });
  }

  async sellHouse(userId: number, sessionId: number, propriedadeId: number) {
    const propriedade = await this.repo.findSessionPosses(sessionId, propriedadeId);
    if (!propriedade) throw new AppError(404, "Propriedade não encontrada!");

    if (propriedade.negociando) {
      throw new AppError(400, "Esta propriedade está em negociação!");
    }

    const player = await this.repo.findPlayerById(userId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");

    if (propriedade.casas === 0) {
      throw new AppError(400, "Esta propriedade não possui casas!");
    }

    const valorVenda = propriedade.posses.propriedade.custo_casa;

    await prisma.$transaction([
      prisma.sessionPosses.update({
        where: { id: propriedade.id },
        data: { casas: { decrement: 1 } },
      }),
      prisma.sessionPlayer.update({
        where: { id: userId },
        data: { saldo: { increment: valorVenda } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "VENDA_CASA",
          detalhes: `${player.nome} vendeu uma casa em ${propriedade.posses.propriedade.nome} por R$ ${valorVenda}`,
        },
      }),
    ]);
  }

  async sellPropriedade(propriedadeId: number, sessionId: number, userId: number) {
    const propriedade = await this.repo.findSessionPosses(sessionId, propriedadeId);
    if (!propriedade) throw new AppError(404, "Propriedade não encontrada!");

    const player = await this.repo.findPlayerById(userId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");

    if (!propriedade.player || propriedade.player.id !== player.id) {
      throw new AppError(400, "Você não é proprietário desta propriedade!");
    }

    if (propriedade.negociando) {
      throw new AppError(400, "Esta propriedade está em negociação!");
    }

    if (propriedade.casas > 0) {
      throw new AppError(400, "Esta propriedade ainda possui casas!");
    }

    const valorVenda = propriedade.posses.propriedade.custo_compra;

    await prisma.$transaction([
      prisma.sessionPosses.update({
        where: { id: propriedade.id },
        data: { playerId: null, casas: 0 },
      }),
      prisma.sessionPlayer.update({
        where: { id: userId },
        data: { saldo: { increment: valorVenda } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "VENDA_PROPRIEDADE",
          detalhes: `${player.nome} vendeu a propriedade ${propriedade.posses.propriedade.nome} por R$ ${valorVenda}`,
        },
      }),
    ]);

    return this.repo.findSessionPosses(sessionId, propriedadeId);
  }

  async hipotecarPropriedade(propriedadeId: number, sessionId: number, userId: number) {
    const propriedade = await this.repo.findSessionPosses(sessionId, propriedadeId);
    if (!propriedade) throw new AppError(404, "Propriedade não encontrada!");

    const player = await this.repo.findPlayerById(userId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");

    if (!propriedade.player || propriedade.player.id !== player.id) {
      throw new AppError(400, "Você não é proprietário desta propriedade!");
    }

    if (propriedade.negociando) {
      throw new AppError(400, "Esta propriedade está em negociação!");
    }

    if (propriedade.casas > 0) {
      throw new AppError(400, "Esta propriedade ainda possui casas!");
    }

    const valorVenda = propriedade.posses.propriedade.hipoteca;

    await prisma.$transaction([
      prisma.sessionPosses.update({
        where: { id: propriedade.id },
        data: { playerId: null, lastOwnerId: userId, casas: 0, hipotecada: true },
      }),
      prisma.sessionPlayer.update({
        where: { id: userId },
        data: { saldo: { increment: valorVenda } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "HIPOTECA_PROPRIEDADE",
          detalhes: `${player.nome} hipotecou a propriedade ${propriedade.posses.propriedade.nome} por R$ ${valorVenda}`,
        },
      }),
    ]);

    return this.repo.findSessionPosses(sessionId, propriedadeId);
  }

  async comprarHipotecada(sessionPossesId: number, sessionId: number, compradorId: number) {
    const sp = await this.repo.findSessionPossesById(sessionPossesId);
    if (!sp) throw new AppError(404, "Propriedade não encontrada");
    if (!sp.hipotecada) throw new AppError(400, "Esta propriedade não está hipotecada");
    if (sp.playerId) throw new AppError(400, "Esta propriedade já tem dono");

    const comprador = await this.repo.findPlayerById(compradorId);
    if (!comprador) throw new AppError(404, "Jogador não encontrado");

    const valor = sp.posses.propriedade.hipoteca;
    const valorComJuros = Math.round(valor * 1.1);

    if (comprador.saldo < valorComJuros) {
      throw new AppError(400, "Saldo insuficiente para comprar a hipoteca");
    }

    const originalOwnerId = sp.lastOwnerId;

    // Se o comprador é o dono original, executa direto (sem notificação)
    if (originalOwnerId === compradorId) {
      await prisma.$transaction([
        prisma.sessionPosses.update({
          where: { id: sessionPossesId },
          data: { playerId: compradorId, lastOwnerId: null, hipotecada: false },
        }),
        prisma.sessionPlayer.update({
          where: { id: compradorId },
          data: { saldo: { decrement: valorComJuros } },
        }),
        prisma.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "DESHIPOTECA",
            detalhes: `${comprador.nome} quitou a hipoteca de ${sp.posses.propriedade.nome} por R$ ${valorComJuros}`,
          },
        }),
      ]);
      return { direto: true };
    }

    // Outro jogador comprando — precisa de aprovação do dono original
    if (!originalOwnerId) {
      // Propriedade hipotecada antes da migration de lastOwnerId: permite compra direta
      await prisma.$transaction([
        prisma.sessionPosses.update({
          where: { id: sessionPossesId },
          data: { playerId: compradorId, lastOwnerId: null, hipotecada: false },
        }),
        prisma.sessionPlayer.update({
          where: { id: compradorId },
          data: { saldo: { decrement: valorComJuros } },
        }),
        prisma.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "COMPRA_HIPOTECADA",
            detalhes: `${comprador.nome} comprou a hipoteca de ${sp.posses.propriedade.nome} por R$ ${valorComJuros}`,
          },
        }),
      ]);
      return { direto: true };
    }

    const notification = await this.repo.createNotification({
      sessionId: Number(sessionId),
      tipo: "compra_hipotecada",
      fromPlayerId: compradorId,
      toPlayerId: originalOwnerId,
      sessionPossesId,
    });

    return { direto: false, notification };
  }

  async responderNotificacao(notificationId: number, aceitar: boolean, respondedorId: number) {
    const notif = await this.repo.findNotificationById(notificationId);
    if (!notif) throw new AppError(404, "Notificação não encontrada");
    if (notif.status !== "pendente") throw new AppError(400, "Notificação já respondida");
    if (notif.toPlayerId !== respondedorId) throw new AppError(403, "Você não é o destinatário desta notificação");

    const sp = await this.repo.findSessionPossesById(notif.sessionPossesId);
    if (!sp) throw new AppError(404, "Propriedade não encontrada");
    if (sp.playerId) throw new AppError(400, "Esta propriedade já foi comprada por outro jogador");

    if (!aceitar) {
      await this.repo.updateNotification(notificationId, {
        status: "recusada",
        respondedAt: new Date(),
      });
      return { aceita: false };
    }

    const comprador = await this.repo.findPlayerById(notif.fromPlayerId);
    if (!comprador) throw new AppError(404, "Comprador não encontrado");

    const valor = sp.posses.propriedade.hipoteca;
    const valorComJuros = Math.round(valor * 1.1);

    if (comprador.saldo < valorComJuros) {
      await this.repo.updateNotification(notificationId, {
        status: "recusada",
        respondedAt: new Date(),
      });
      throw new AppError(400, "Comprador não tem saldo suficiente");
    }

    await prisma.$transaction([
      prisma.sessionPosses.update({
        where: { id: notif.sessionPossesId },
        data: { playerId: notif.fromPlayerId, lastOwnerId: null, hipotecada: false },
      }),
      prisma.sessionPlayer.update({
        where: { id: notif.fromPlayerId },
        data: { saldo: { decrement: valorComJuros } },
      }),
      prisma.sessionPlayer.update({
        where: { id: notif.toPlayerId },
        data: { saldo: { increment: valor } },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(notif.sessionId),
          data: new Date(),
          tipo: "COMPRA_HIPOTECADA",
          detalhes: `${comprador.nome} comprou a hipoteca de ${sp.posses.propriedade.nome} de ${notif.toPlayer.nome} por R$ ${valorComJuros}`,
        },
      }),
      prisma.notification.update({
        where: { id: notificationId },
        data: { status: "aceita", respondedAt: new Date() },
      }),
    ]);

    return { aceita: true, fromPlayerId: notif.fromPlayerId, toPlayerId: notif.toPlayerId };
  }

  async trocarPropriedade(propriedadeId: number, sessionId: number, userId: number) {
    const propriedade = await this.repo.findSessionPosses(sessionId, propriedadeId);
    if (!propriedade) throw new AppError(404, "Propriedade não encontrada!");

    const player = await this.repo.findPlayerById(userId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");

    await prisma.$transaction([
      prisma.sessionPosses.update({
        where: { id: propriedade.id },
        data: { playerId: player.id, casas: 0 },
      }),
      prisma.historico.create({
        data: {
          sessionId: Number(sessionId),
          data: new Date(),
          tipo: "TROCA_PROPRIEDADE",
          detalhes: `${player.nome} adquiriu a propriedade ${propriedade.posses.propriedade.nome}`,
        },
      }),
    ]);
  }
}
