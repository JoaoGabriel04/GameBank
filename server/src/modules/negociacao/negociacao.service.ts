import { NegociacaoRepository } from "./negociacao.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import type { PrismaPromise } from "../../../generated/prisma/index.js";
import { NEGOTIATION_TIMEOUT_MS, MAX_NEG_VALOR } from "../../utils/level.js";

type PrismaOp = PrismaPromise<unknown>;

interface NegItemInput {
  sessionPossesId?: number | null;
  fromSide: boolean; // true = "o que ofereço", false = "o que quero"
  valor?: number | null;
}

type SessionPossesFull = Awaited<ReturnType<NegociacaoRepository["findSessionPosses"]>>;

export class NegociacaoService {
  constructor(private repo = new NegociacaoRepository()) {}

  async criarNegociacao(
    sessionId: number,
    fromPlayerId: number,
    toPlayerId: number,
    offerItems: NegItemInput[],
    wantItems: NegItemInput[]
  ) {
    const fromPlayer = await this.repo.findPlayerById(fromPlayerId);
    if (!fromPlayer) throw new AppError(404, "Proponente não encontrado!");

    const toPlayer = await this.repo.findPlayerById(toPlayerId);
    if (!toPlayer) throw new AppError(404, "Alvo não encontrado!");

    if (fromPlayerId === toPlayerId) {
      throw new AppError(400, "Não pode negociar consigo mesmo!");
    }

    const allItems = [...offerItems, ...wantItems];
    if (allItems.length === 0) {
      throw new AppError(400, "A negociação precisa ter pelo menos um item!");
    }

    const hasContent = allItems.some(
      (i) => i.sessionPossesId != null || (i.valor != null && i.valor > 0)
    );
    if (!hasContent) {
      throw new AppError(400, "A negociação precisa ter pelo menos uma propriedade ou valor em dinheiro!");
    }

    for (const item of allItems) {
      if (item.valor != null && item.valor > MAX_NEG_VALOR) {
        throw new AppError(400, `Valor máximo permitido em negociação é R$ ${MAX_NEG_VALOR.toLocaleString("pt-BR")}`);
      }
      if (item.valor != null && item.valor < 0) {
        throw new AppError(400, "Valor não pode ser negativo!");
      }
    }

    // Valida: proponente é dono das offered, alvo é dono das wanted
    const offerSpMap = new Map<number, NonNullable<SessionPossesFull>>();
    for (const item of offerItems) {
      if (!item.sessionPossesId) continue;
      const sp = await this.repo.findSessionPosses(sessionId, item.sessionPossesId);
      if (!sp || sp.playerId !== fromPlayerId) {
        throw new AppError(400, "Você não é dono de uma das propriedades oferecidas!");
      }
      if (sp.negociando) {
        throw new AppError(400, "Uma das propriedades já está em negociação!");
      }
      if (sp.hipotecada) {
        throw new AppError(400, "Não pode negociar propriedades hipotecadas!");
      }
      offerSpMap.set(item.sessionPossesId, sp);
    }

    const wantSpMap = new Map<number, NonNullable<SessionPossesFull>>();
    for (const item of wantItems) {
      if (!item.sessionPossesId) continue;
      const sp = await this.repo.findSessionPosses(sessionId, item.sessionPossesId);
      if (!sp || sp.playerId !== toPlayerId) {
        throw new AppError(400, "O alvo não é dono de uma das propriedades solicitadas!");
      }
      wantSpMap.set(item.sessionPossesId, sp);
    }

    // Valida regra do grupo de cor: se uma prop tem casas, TODAS as props
    // do mesmo grupo de cor (que o dono possui) precisam estar na negociação
    const fromProps = await this.repo.findSessionPossesByPlayerFull(sessionId, fromPlayerId);
    const toProps = await this.repo.findSessionPossesByPlayerFull(sessionId, toPlayerId);

    const fromGroupMap = this.buildGroupMap(fromProps);
    const toGroupMap = this.buildGroupMap(toProps);

    const offerIds = new Set(
      offerItems.map((i) => i.sessionPossesId).filter((id): id is number => id != null)
    );
    const wantIds = new Set(
      wantItems.map((i) => i.sessionPossesId).filter((id): id is number => id != null)
    );

    for (const [, sp] of offerSpMap) {
      if (sp.casas > 0) {
        const grupo = sp.propriedade.grupo_cor;
        const allInGroup = fromGroupMap.get(grupo) ?? [];
        if (!allInGroup.every((pid) => offerIds.has(pid))) {
          throw new AppError(
            400,
            `"${sp.propriedade.nome}" tem casas. Você precisa oferecer TODAS as propriedades do grupo ${grupo} ou vender as casas primeiro.`
          );
        }
      }
    }

    for (const [, sp] of wantSpMap) {
      if (sp.casas > 0) {
        const grupo = sp.propriedade.grupo_cor;
        const allInGroup = toGroupMap.get(grupo) ?? [];
        if (!allInGroup.every((pid) => wantIds.has(pid))) {
          throw new AppError(
            400,
            `"${sp.propriedade.nome}" tem casas. Você precisa solicitar TODAS as propriedades do grupo ${grupo} ou o dono vender as casas primeiro.`
          );
        }
      }
    }

    const expiresAt = new Date(Date.now() + NEGOTIATION_TIMEOUT_MS);

    // Cria negociação com expiresAt
    const negotiation = await this.repo.createNegotiation({
      sessionId,
      fromPlayerId,
      toPlayerId,
      expiresAt,
    });

    // Cria items
    const dbItems = allItems.map((i) => ({
      sessionPossesId: i.sessionPossesId,
      fromSide: i.fromSide,
      valor: i.valor,
    }));

    if (dbItems.length > 0) {
      await this.repo.createNegotiationItems(negotiation.id, dbItems);
    }

    // Trava propriedades do proponente
    for (const item of offerItems) {
      if (item.sessionPossesId) {
        await this.repo.setNegociando(item.sessionPossesId, true);
      }
    }

    const result = await this.repo.findNegotiationById(negotiation.id);
    return result;
  }

  async aceitarNegociacao(negotiationId: number, playerId: number) {
    const negotiation = await this.repo.findNegotiationById(negotiationId);
    if (!negotiation) throw new AppError(404, "Negociação não encontrada!");
    if (negotiation.status !== "pendente") {
      throw new AppError(400, "Esta negociação não está mais pendente!");
    }
    if (negotiation.expiresAt && new Date() > negotiation.expiresAt) {
      throw new AppError(400, "Esta negociação já expirou!");
    }
    if (negotiation.toPlayerId !== playerId) {
      throw new AppError(403, "Apenas o alvo pode aceitar esta negociação!");
    }

    const items = negotiation.items as {
      id: number;
      sessionPossesId: number | null;
      fromSide: boolean;
      valor: number | null;
    }[];

    const offerProps = items.filter((i) => i.fromSide && i.sessionPossesId);
    const wantProps = items.filter((i) => !i.fromSide && i.sessionPossesId);

    const offerMoney = items
      .filter((i) => i.fromSide && i.valor)
      .reduce((acc, i) => acc + (i.valor ?? 0), 0);
    const wantMoney = items
      .filter((i) => !i.fromSide && i.valor)
      .reduce((acc, i) => acc + (i.valor ?? 0), 0);

    const netMoney = offerMoney - wantMoney;

    const fromPlayer = await this.repo.findPlayerById(negotiation.fromPlayerId);
    const toPlayer = await this.repo.findPlayerById(negotiation.toPlayerId);
    if (!fromPlayer || !toPlayer) throw new AppError(404, "Jogador não encontrado!");

    if (netMoney > 0 && fromPlayer.saldo < netMoney) {
      throw new AppError(400, "Proponente não tem saldo suficiente!");
    }
    if (netMoney < 0 && toPlayer.saldo < Math.abs(netMoney)) {
      throw new AppError(400, "Alvo não tem saldo suficiente!");
    }

    const operacoes: PrismaOp[] = [];

    for (const item of offerProps) {
      operacoes.push(
        prisma.sessionPosses.update({
          where: { id: item.sessionPossesId! },
          data: { playerId: negotiation.toPlayerId, negociando: false, casas: 0 },
        })
      );
    }
    for (const item of wantProps) {
      operacoes.push(
        prisma.sessionPosses.update({
          where: { id: item.sessionPossesId! },
          data: { playerId: negotiation.fromPlayerId, negociando: false, casas: 0 },
        })
      );
    }

    if (netMoney > 0) {
      operacoes.push(
        prisma.sessionPlayer.update({
          where: { id: negotiation.fromPlayerId },
          data: { saldo: { decrement: netMoney } },
        }),
        prisma.sessionPlayer.update({
          where: { id: negotiation.toPlayerId },
          data: { saldo: { increment: netMoney } },
        })
      );
    } else if (netMoney < 0) {
      operacoes.push(
        prisma.sessionPlayer.update({
          where: { id: negotiation.toPlayerId },
          data: { saldo: { decrement: Math.abs(netMoney) } },
        }),
        prisma.sessionPlayer.update({
          where: { id: negotiation.fromPlayerId },
          data: { saldo: { increment: Math.abs(netMoney) } },
        })
      );
    }

    operacoes.push(
      prisma.negotiation.update({
        where: { id: negotiationId },
        data: { status: "aceita", respondedAt: new Date() },
      }),
      prisma.historico.create({
        data: {
          sessionId: negotiation.sessionId,
          data: new Date(),
          tipo: "NEGOCIACAO_ACEITA",
          detalhes: `Negociação entre ${fromPlayer.nome} e ${toPlayer.nome} foi aceita.`,
        },
      })
    );

    await prisma.$transaction(operacoes);
    return this.repo.findNegotiationById(negotiationId);
  }

  async recusarNegociacao(negotiationId: number, playerId: number) {
    const negotiation = await this.repo.findNegotiationById(negotiationId);
    if (!negotiation) throw new AppError(404, "Negociação não encontrada!");
    if (negotiation.status !== "pendente") {
      throw new AppError(400, "Esta negociação não está mais pendente!");
    }
    if (negotiation.expiresAt && new Date() > negotiation.expiresAt) {
      throw new AppError(400, "Esta negociação já expirou!");
    }
    if (negotiation.toPlayerId !== playerId) {
      throw new AppError(403, "Apenas o alvo pode recusar esta negociação!");
    }

    const unlockOps: PrismaOp[] = [];

    for (const item of negotiation.items) {
      if (item.fromSide && item.sessionPossesId) {
        unlockOps.push(
          prisma.sessionPosses.update({
            where: { id: item.sessionPossesId },
            data: { negociando: false },
          })
        );
      }
    }

    unlockOps.push(
      prisma.negotiation.update({
        where: { id: negotiationId },
        data: { status: "recusada", respondedAt: new Date() },
      }),
      prisma.historico.create({
        data: {
          sessionId: negotiation.sessionId,
          data: new Date(),
          tipo: "NEGOCIACAO_RECUSADA",
          detalhes: `Negociação entre ${negotiation.fromPlayer.nome} e ${negotiation.toPlayer.nome} foi recusada.`,
        },
      })
    );

    await prisma.$transaction(unlockOps);
    return this.repo.findNegotiationById(negotiationId);
  }

  async contraOfertar(
    negotiationId: number,
    playerId: number,
    newOfferItems: NegItemInput[],
    newWantItems: NegItemInput[]
  ) {
    const oldNegotiation = await this.repo.findNegotiationById(negotiationId);
    if (!oldNegotiation) throw new AppError(404, "Negociação não encontrada!");
    if (oldNegotiation.status !== "pendente") {
      throw new AppError(400, "Esta negociação não está mais pendente!");
    }
    if (oldNegotiation.expiresAt && new Date() > oldNegotiation.expiresAt) {
      throw new AppError(400, "Esta negociação já expirou!");
    }
    if (oldNegotiation.toPlayerId !== playerId) {
      throw new AppError(403, "Apenas o alvo pode contra-ofertar!");
    }

    // Destrava props antigas e fecha negociação anterior
    const unlockOps: PrismaOp[] = [];

    for (const item of oldNegotiation.items) {
      if (item.fromSide && item.sessionPossesId) {
        unlockOps.push(
          prisma.sessionPosses.update({
            where: { id: item.sessionPossesId },
            data: { negociando: false },
          })
        );
      }
    }
    unlockOps.push(
      prisma.negotiation.update({
        where: { id: negotiationId },
        data: { status: "recusada", respondedAt: new Date() },
      })
    );
    await prisma.$transaction(unlockOps);

    // Cria nova negociação com papéis invertidos — timer recomeça do zero
    return this.criarNegociacao(
      oldNegotiation.sessionId,
      oldNegotiation.toPlayerId,
      oldNegotiation.fromPlayerId,
      newOfferItems,
      newWantItems
    );
  }

  async listarPendentes(sessionId: number, playerId: number) {
    return this.repo.findPendentesByPlayer(sessionId, playerId);
  }

  private buildGroupMap(
    props: Awaited<ReturnType<NegociacaoRepository["findSessionPossesByPlayerFull"]>>
  ): Map<string, number[]> {
    const map = new Map<string, number[]>();
    for (const sp of props) {
      const grupo = sp.propriedade.grupo_cor;
      if (!map.has(grupo)) map.set(grupo, []);
      map.get(grupo)!.push(sp.id);
    }
    return map;
  }
}
