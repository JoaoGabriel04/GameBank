import { PropriedadeRepository } from "./propriedade.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { withLock } from "../../middleware/lock.middleware.js";
import { MissionsService } from "../missions/missions.service.js";
import { getEvento } from "../../constants/eventos.js";
import { aplicarMod } from "../../shared/economia-core.js";

// Rastreia quais propriedades já receberam casa neste turno (1 casa máxima
// por propriedade por rodada). Chave: "sessionId:playerId".
const construcoesNesteTurno = new Map<string, Set<number>>();

export class PropriedadeService {
  private missionService = new MissionsService();
  constructor(private repo = new PropriedadeRepository()) {}

  limparConstrucoesTurno(sessionId: number, playerId: number) {
    const key = `${sessionId}:${playerId}`;
    construcoesNesteTurno.delete(key);
  }

  async getPropById(propriedadeId: number) {
    const prop = await this.repo.findPropriedadeById(propriedadeId);
    if (!prop) throw new AppError(404, "Propriedade não encontrada");
    return prop;
  }

  async buyProp(propId: number, sessionId: number, userId: number) {
    return withLock(`prop:${propId}`, async () => {
      const player = await this.repo.findPlayerById(userId);
      if (!player) throw new AppError(404, "Jogador não encontrado");

      const sessionPosses = await this.repo.findSessionPosses(sessionId, propId);
      if (!sessionPosses) throw new AppError(404, "Propriedade não encontrada nesta sessão");
      if (sessionPosses.playerId) throw new AppError(400, "Propriedade já foi comprada");

      const propriedade = sessionPosses.propriedade;
      if (!propriedade) throw new AppError(404, "Dados da propriedade não encontrados");

      // Propriedade sem dono mas ainda hipotecada (ex.: dono anterior faliu
      // ou desistiu) custa 1.2x — checar saldo contra ESSE valor, não o
      // custo_compra base, senão o jogador pode ficar com saldo negativo.
      const valorCompra = sessionPosses.hipotecada ? propriedade.custo_compra * 1.2 : propriedade.custo_compra;

      // Race condition (FIX_RACE_CONDITION_SALDO): o lock `prop:${propId}`
      // serializa duas compras da MESMA propriedade, mas não protege o
      // saldo do jogador contra uma corrida cruzada (comprar duas
      // propriedades DIFERENTES ao mesmo tempo). `updateMany` condicional
      // torna a checagem e o decremento atômicos independente do lock.
      await prisma.$transaction(async (tx) => {
        const debitado = await tx.sessionPlayer.updateMany({
          where: { id: userId, saldo: { gte: valorCompra } },
          data: { saldo: { decrement: valorCompra } },
        });
        if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente");

        await tx.sessionPosses.updateMany({
          where: { sessionId, propId },
          // Limpa hipotecada/lastOwnerId — a compra normal (ao cair na casa)
          // de uma propriedade sem dono e hipotecada precisa devolvê-la ao
          // estado normal, senão ela fica presa como "hipotecada" mesmo já
          // tendo um dono novo e pago.
          data: { playerId: userId, hipotecada: false, lastOwnerId: null },
        });
        await tx.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "COMPRA_PROPRIEDADE",
            detalhes: `${player.nome} comprou a propriedade em ${propriedade.nome} por R$ ${valorCompra}`,
          },
        });
      });

      if (player.userId) {
        try { await this.missionService.track(player.userId, "properties_bought", 1); } catch {}
      }

      return this.repo.findSessionPosses(sessionId, propId);
    });
  }

  // Leilão Cego (Mecânica 4): mesma transferência de buyProp, mas cobrando
  // o valor do LANCE vencedor, não o preço de tabela. Lance é vinculante —
  // o vencedor é obrigado a comprar mesmo se (por alguma race rara) o
  // saldo não cobrir mais no momento do acerto; nesse caso paga o que der
  // e o restante vira dívida, em vez de bloquear a transferência.
  async buyPropPorValor(propId: number, sessionId: number, playerId: number, valor: number) {
    return withLock(`prop:${propId}`, async () => {
      const player = await this.repo.findPlayerById(playerId);
      if (!player) throw new AppError(404, "Jogador não encontrado");

      const sessionPosses = await this.repo.findSessionPosses(sessionId, propId);
      if (!sessionPosses) throw new AppError(404, "Propriedade não encontrada nesta sessão");
      if (sessionPosses.playerId) throw new AppError(400, "Propriedade já foi comprada");

      const propriedade = sessionPosses.propriedade;
      if (!propriedade) throw new AppError(404, "Dados da propriedade não encontrados");

      // Race condition (FIX_RACE_CONDITION_SALDO): mesmo padrão de
      // carta.service.ts perder_dinheiro — `pago` continua calculado do
      // mesmo jeito (Math.min), só o decremento vira atômico. Como o lance
      // é vinculante e NUNCA bloqueia a transferência, se a corrida
      // (extremamente rara) fizer o `updateMany` falhar, o valor inteiro
      // vira dívida em vez de travar — mesma filosofia do método.
      const pagoDesejado = Math.min(player.saldo, valor);

      await prisma.$transaction(async (tx) => {
        let pago = 0;
        if (pagoDesejado > 0) {
          const debitado = await tx.sessionPlayer.updateMany({
            where: { id: playerId, saldo: { gte: pagoDesejado } },
            data: { saldo: { decrement: pagoDesejado } },
          });
          pago = debitado.count > 0 ? pagoDesejado : 0;
        }
        const debtValor = valor - pago;

        await tx.sessionPosses.updateMany({
          where: { sessionId, propId },
          data: { playerId, hipotecada: false, lastOwnerId: null },
        });
        await tx.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "LEILAO_ARREMATE",
            detalhes: `${player.nome} arrematou ${propriedade.nome} no leilão por R$ ${valor}` +
              (debtValor > 0 ? ` (R$ ${debtValor} viraram dívida)` : ""),
          },
        });
        if (debtValor > 0) {
          await tx.debt.create({
            data: { sessionId, playerId, valor: debtValor, descricao: `Leilão de ${propriedade.nome} (dívida)` },
          });
        }
      });

      if (player.userId) {
        try { await this.missionService.track(player.userId, "properties_bought", 1); } catch {}
      }

      return this.repo.findSessionPosses(sessionId, propId);
    });
  }

  async buyHouse(userId: number, sessionId: number, propriedadeId: number) {
    return withLock(`prop:${propriedadeId}`, async () => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { turnoAtualPlayerId: true, tipoJogo: true, eventoAtual: true },
      });
      if (session?.tipoJogo === "tabuleiro" && session.turnoAtualPlayerId !== userId) {
        throw new AppError(403, "Só pode comprar casas na sua vez.");
      }

      const propriedade = await this.repo.findSessionPosses(sessionId, propriedadeId);
      if (!propriedade) throw new AppError(404, "Propriedade não encontrada!");

      if (propriedade.negociando) {
        throw new AppError(400, "Esta propriedade está em negociação!");
      }

      const player = await this.repo.findPlayerById(userId);
      if (!player) throw new AppError(404, "Jogador não encontrado!");
      if (player.emPrisao) throw new AppError(400, "Você está na prisão e não pode comprar casas.");

      if (propriedade.propriedade.tipo === "ação") {
        throw new AppError(400, "Não é possível construir casas em ações.");
      }

      // Custo de construção reflete o evento econômico ativo (Escassez de
      // Material / Aquecimento do Mercado) — exclusivo do Modo Tabuleiro,
      // já que eventoAtual só é definido nessas sessões.
      const custoConstrucaoMult = getEvento(session?.eventoAtual)?.efeito.custoConstrucaoMult ?? 1;
      const custoCasa = aplicarMod(propriedade.propriedade.custo_casa, custoConstrucaoMult);

      if (propriedade.casas >= 5) {
        throw new AppError(400, "Esta propriedade já possui o número máximo de casas!");
      }

      await this.requireMonopoly(sessionId, userId, propriedade.propriedade.grupo_cor);

      const key = `${sessionId}:${userId}`;
      const jaConstruiu = construcoesNesteTurno.get(key);
      if (jaConstruiu?.has(propriedadeId)) {
        throw new AppError(400, "Você já comprou uma casa nesta propriedade neste turno.");
      }

      if (!jaConstruiu) construcoesNesteTurno.set(key, new Set([propriedadeId]));
      else jaConstruiu.add(propriedadeId);

      // Race condition (FIX_RACE_CONDITION_SALDO): checagem e decremento
      // atômicos — o lock `prop:${propriedadeId}` não protege contra
      // comprar casas em DUAS propriedades diferentes ao mesmo tempo.
      await prisma.$transaction(async (tx) => {
        const debitado = await tx.sessionPlayer.updateMany({
          where: { id: userId, saldo: { gte: custoCasa } },
          data: { saldo: { decrement: custoCasa } },
        });
        if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente para comprar uma casa!");

        await tx.sessionPosses.update({
          where: { id: propriedade.id },
          data: { casas: { increment: 1 } },
        });
        await tx.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "COMPRA_CASA",
            detalhes: `${player.nome} comprou uma casa em ${propriedade.propriedade.nome} por R$ ${custoCasa}`,
          },
        });
      });

      if (player.userId) {
        try { await this.missionService.track(player.userId, "houses_built", 1); } catch {}
      }
    });
  }

  async buyHousesBatch(userId: number, sessionId: number, sessaoPossesIds: number[]) {
    return withLock(`batch:houses:${sessionId}:${userId}`, async () => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { turnoAtualPlayerId: true, tipoJogo: true, eventoAtual: true },
      });
      if (session?.tipoJogo === "tabuleiro" && session.turnoAtualPlayerId !== userId) {
        throw new AppError(403, "Só pode comprar casas na sua vez.");
      }

      if (!sessaoPossesIds.length) {
        throw new AppError(400, "Nenhuma propriedade selecionada");
      }

      const player = await this.repo.findPlayerById(userId);
      if (!player) throw new AppError(404, "Jogador não encontrado");
      if (player.emPrisao) throw new AppError(400, "Você está na prisão e não pode comprar casas.");

      const properties = await prisma.sessionPosses.findMany({
        where: { id: { in: sessaoPossesIds }, sessionId },
        include: { propriedade: true },
      });

      if (properties.length !== sessaoPossesIds.length) {
        throw new AppError(404, "Alguma(s) propriedade(s) não encontrada(s)");
      }

      const custoConstrucaoMult = getEvento(session?.eventoAtual)?.efeito.custoConstrucaoMult ?? 1;
      const key = `${sessionId}:${userId}`;
      let jaConstruiu = construcoesNesteTurno.get(key);
      let totalCost = 0;
      const nomes: string[] = [];
      for (const prop of properties) {
        if (prop.playerId !== userId) {
          throw new AppError(400, `Você não é dono de ${prop.propriedade.nome}`);
        }
        if (prop.negociando) {
          throw new AppError(400, `${prop.propriedade.nome} está em negociação`);
        }
        if (prop.propriedade.tipo === "ação") {
          throw new AppError(400, `Não é possível construir casas em ${prop.propriedade.nome} (ação).`);
        }
        if (prop.casas >= 5) {
          throw new AppError(400, `${prop.propriedade.nome} já tem o máximo de casas`);
        }
        if (jaConstruiu?.has(prop.propriedade.id)) {
          throw new AppError(400, `${prop.propriedade.nome} já recebeu uma casa neste turno.`);
        }
        await this.requireMonopoly(sessionId, userId, prop.propriedade.grupo_cor);
        totalCost += aplicarMod(prop.propriedade.custo_casa, custoConstrucaoMult);
        nomes.push(prop.propriedade.nome);
      }

      // Marca no tracking em memória
      if (!jaConstruiu) construcoesNesteTurno.set(key, new Set(properties.map(p => p.propriedade.id)));
      else properties.forEach(p => jaConstruiu!.add(p.propriedade.id));

      // Race condition (FIX_RACE_CONDITION_SALDO): checagem e decremento
      // atômicos.
      await prisma.$transaction(async (tx) => {
        const debitado = await tx.sessionPlayer.updateMany({
          where: { id: userId, saldo: { gte: totalCost } },
          data: { saldo: { decrement: totalCost } },
        });
        if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente para comprar as casas");

        for (const prop of properties) {
          await tx.sessionPosses.update({
            where: { id: prop.id },
            data: { casas: { increment: 1 } },
          });
        }
        await tx.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "COMPRA_CASA_LOTE",
            detalhes: `${player.nome} comprou ${properties.length} casa(s): ${nomes.join(", ")} por R$ ${totalCost}`,
          },
        });
      });

      if (player.userId) {
        try { await this.missionService.track(player.userId, "houses_built", properties.length); } catch {}
      }
    });
  }

  async sellHousesBatch(userId: number, sessionId: number, items: { sessaoPossesId: number; quantidade: number }[]) {
    return withLock(`batch:houses:${sessionId}:${userId}`, async () => {
      if (!items.length) {
        throw new AppError(400, "Nenhuma propriedade selecionada");
      }

      const player = await this.repo.findPlayerById(userId);
      if (!player) throw new AppError(404, "Jogador não encontrado");

      const ids = items.map((i) => i.sessaoPossesId);
      const properties = await prisma.sessionPosses.findMany({
        where: { id: { in: ids }, sessionId },
        include: { propriedade: true },
      });

      if (properties.length !== ids.length) {
        throw new AppError(404, "Alguma(s) propriedade(s) não encontrada(s)");
      }

      const propMap = new Map(properties.map((p) => [p.id, p]));
      let totalValue = 0;
      const detalhesItens: string[] = [];

      for (const item of items) {
        const prop = propMap.get(item.sessaoPossesId);
        if (!prop) throw new AppError(404, `Propriedade #${item.sessaoPossesId} não encontrada`);
        if (prop.playerId !== userId) {
          throw new AppError(400, `Você não é dono de ${prop.propriedade.nome}`);
        }
        if (prop.negociando) {
          throw new AppError(400, `${prop.propriedade.nome} está em negociação`);
        }
        if (item.quantidade <= 0) {
          throw new AppError(400, `Quantidade inválida para ${prop.propriedade.nome}`);
        }
        if (prop.casas < item.quantidade) {
          throw new AppError(400, `${prop.propriedade.nome} tem apenas ${prop.casas} casa(s), não pode vender ${item.quantidade}`);
        }
        const valorItem = prop.propriedade.custo_casa * item.quantidade;
        totalValue += valorItem;
        detalhesItens.push(`${item.quantidade} casa(s) de ${prop.propriedade.nome}`);
      }

      const updateQueries = items.map((item) =>
        prisma.sessionPosses.update({
          where: { id: item.sessaoPossesId },
          data: { casas: { decrement: item.quantidade } },
        })
      );

      await prisma.$transaction([
        ...updateQueries,
        prisma.sessionPlayer.update({
          where: { id: userId },
          data: { saldo: { increment: totalValue } },
        }),
        prisma.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "VENDA_CASA_LOTE",
            detalhes: `${player.nome} vendeu ${detalhesItens.join(", ")} por R$ ${totalValue}`,
          },
        }),
      ]);
    });
  }

  async sellHouse(userId: number, sessionId: number, propriedadeId: number) {
    return withLock(`prop:${propriedadeId}`, async () => {
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

      const valorVenda = propriedade.propriedade.custo_casa;

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
            detalhes: `${player.nome} vendeu uma casa em ${propriedade.propriedade.nome} por R$ ${valorVenda}`,
          },
        }),
      ]);
    });
  }

  async sellPropriedade(propriedadeId: number, sessionId: number, userId: number) {
    return withLock(`sell:${propriedadeId}`, async () => {
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

      // Verifica se a propriedade é garantia de empréstimo
      const empAtivoVenda = await prisma.emprestimo.findFirst({
        where: { sessionId, playerId: userId, quitado: false, garantiaPropId: propriedadeId },
      });
      if (empAtivoVenda) {
        throw new AppError(400, "Esta propriedade está dada como garantia de um empréstimo.");
      }

      const valorVenda = propriedade.propriedade.custo_compra;

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
            detalhes: `${player.nome} vendeu a propriedade ${propriedade.propriedade.nome} por R$ ${valorVenda}`,
          },
        }),
      ]);

      return this.repo.findSessionPosses(sessionId, propriedadeId);
    });
  }

  async hipotecarPropriedade(propriedadeId: number, sessionId: number, userId: number) {
    return withLock(`hipoteca:${propriedadeId}`, async () => {
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

      // Verifica se a propriedade é garantia de empréstimo
      const empAtivoHip = await prisma.emprestimo.findFirst({
        where: { sessionId, playerId: userId, quitado: false, garantiaPropId: propriedadeId },
      });
      if (empAtivoHip) {
        throw new AppError(400, "Esta propriedade está dada como garantia de um empréstimo.");
      }

      const valorVenda = propriedade.propriedade.hipoteca;

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
            detalhes: `${player.nome} hipotecou a propriedade ${propriedade.propriedade.nome} por R$ ${valorVenda}`,
          },
        }),
      ]);

      return this.repo.findSessionPosses(sessionId, propriedadeId);
    });
  }

  async comprarHipotecada(sessionPossesId: number, sessionId: number, compradorId: number) {
    const sp = await this.repo.findSessionPossesById(sessionPossesId);
    if (!sp) throw new AppError(404, "Propriedade não encontrada");
    if (!sp.hipotecada) throw new AppError(400, "Esta propriedade não está hipotecada");
    if (sp.playerId) throw new AppError(400, "Esta propriedade já tem dono");

    const comprador = await this.repo.findPlayerById(compradorId);
    if (!comprador) throw new AppError(404, "Jogador não encontrado");

    const valor = sp.propriedade.hipoteca;
    const valorComJuros = Math.round(valor * 1.1);

    const originalOwnerId = sp.lastOwnerId;

    // Se o comprador é o dono original, executa direto (sem notificação)
    if (originalOwnerId === compradorId) {
      // Race condition (FIX_RACE_CONDITION_SALDO): checagem e decremento
      // atômicos.
      await prisma.$transaction(async (tx) => {
        const debitado = await tx.sessionPlayer.updateMany({
          where: { id: compradorId, saldo: { gte: valorComJuros } },
          data: { saldo: { decrement: valorComJuros } },
        });
        if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente para comprar a hipoteca");

        await tx.sessionPosses.update({
          where: { id: sessionPossesId },
          data: { playerId: compradorId, lastOwnerId: null, hipotecada: false },
        });
        await tx.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "DESHIPOTECA",
            detalhes: `${comprador.nome} quitou a hipoteca de ${sp.propriedade.nome} por R$ ${valorComJuros}`,
          },
        });
      });
      return { direto: true };
    }

    // Outro jogador comprando — precisa de aprovação do dono original
    if (!originalOwnerId) {
      // Propriedade hipotecada antes da migration de lastOwnerId: permite compra direta
      await prisma.$transaction(async (tx) => {
        const debitado = await tx.sessionPlayer.updateMany({
          where: { id: compradorId, saldo: { gte: valorComJuros } },
          data: { saldo: { decrement: valorComJuros } },
        });
        if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente para comprar a hipoteca");

        await tx.sessionPosses.update({
          where: { id: sessionPossesId },
          data: { playerId: compradorId, lastOwnerId: null, hipotecada: false },
        });
        await tx.historico.create({
          data: {
            sessionId: Number(sessionId),
            data: new Date(),
            tipo: "COMPRA_HIPOTECADA",
            detalhes: `${comprador.nome} comprou a hipoteca de ${sp.propriedade.nome} por R$ ${valorComJuros}`,
          },
        });
      });
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

    const valor = sp.propriedade.hipoteca;
    const valorComJuros = Math.round(valor * 1.1);

    if (comprador.saldo < valorComJuros) {
      await this.repo.updateNotification(notificationId, {
        status: "recusada",
        respondedAt: new Date(),
      });
      throw new AppError(400, "Comprador não tem saldo suficiente");
    }

    // Race condition (FIX_RACE_CONDITION_SALDO): a checagem acima é só uma
    // rejeição otimista (evita abrir transação à toa) — o decremento real
    // é atômico aqui dentro, contra o saldo mais atual no banco.
    try {
      await prisma.$transaction(async (tx) => {
        const debitado = await tx.sessionPlayer.updateMany({
          where: { id: notif.fromPlayerId, saldo: { gte: valorComJuros } },
          data: { saldo: { decrement: valorComJuros } },
        });
        if (debitado.count === 0) throw new AppError(400, "Comprador não tem saldo suficiente");

        await tx.sessionPosses.update({
          where: { id: notif.sessionPossesId },
          data: { playerId: notif.fromPlayerId, lastOwnerId: null, hipotecada: false },
        });
        await tx.sessionPlayer.update({
          where: { id: notif.toPlayerId },
          data: { saldo: { increment: valor } },
        });
        await tx.historico.create({
          data: {
            sessionId: Number(notif.sessionId),
            data: new Date(),
            tipo: "COMPRA_HIPOTECADA",
            detalhes: `${comprador.nome} comprou a hipoteca de ${sp.propriedade.nome} de ${notif.toPlayer.nome} por R$ ${valorComJuros}`,
          },
        });
        await tx.notification.update({
          where: { id: notificationId },
          data: { status: "aceita", respondedAt: new Date() },
        });
      });
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 400) {
        await this.repo.updateNotification(notificationId, { status: "recusada", respondedAt: new Date() });
      }
      throw err;
    }

    return { aceita: true, fromPlayerId: notif.fromPlayerId, toPlayerId: notif.toPlayerId };
  }

  async trocarPropriedade(propriedadeId: number, sessionId: number, userId: number) {
    return withLock(`troca:${propriedadeId}`, async () => {
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
            detalhes: `${player.nome} adquiriu a propriedade ${propriedade.propriedade.nome}`,
          },
        }),
      ]);
    });
  }

  private async requireMonopoly(sessionId: number, playerId: number, grupoCor: string) {
    const groupPosses = await this.repo.findSessionPossesByGroup(sessionId, grupoCor);
    const ownedAll = groupPosses.every((sp) => sp.playerId === playerId);
    if (!ownedAll) {
      throw new AppError(400, "Você precisa ter todas as propriedades do grupo para construir casas.");
    }
  }
}
