import { NegociacaoRepository } from "./negociacao.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { withLock } from "../../middleware/lock.middleware.js";

interface NegItemInput {
  sessionPossesId?: number | null;
  fromSide: boolean; // true = "o que ofereço", false = "o que quero"
  valor?: number | null;
}

const NEGOTIATION_TIMEOUT_MS = 60_000;
const negotiationTimers = new Map<number, NodeJS.Timeout>();

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

    // Valida: proponente é dono das offered, alvo é dono das wanted
    const offerSpMap = new Map<number, Awaited<ReturnType<NegociacaoRepository["findSessionPosses"]>>>();
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

    const wantSpMap = new Map<number, Awaited<ReturnType<NegociacaoRepository["findSessionPosses"]>>>();
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

    const offerIds = new Set(offerItems.map((i) => i.sessionPossesId).filter((id): id is number => id != null));
    const wantIds = new Set(wantItems.map((i) => i.sessionPossesId).filter((id): id is number => id != null));

    for (const [id, sp] of offerSpMap) {
      if (sp && sp.casas > 0) {
        const grupo = sp.posses.propriedade.grupo_cor;
        const allInGroup = fromGroupMap.get(grupo) || [];
        const included = allInGroup.every((pid) => offerIds.has(pid));
        if (!included) {
          throw new AppError(
            400,
            `"${sp.posses.propriedade.nome}" tem casas. Você precisa oferecer TODAS as propriedades do grupo ${grupo} ou vender as casas primeiro.`
          );
        }
      }
    }

    for (const [id, sp] of wantSpMap) {
      if (sp && sp.casas > 0) {
        const grupo = sp.posses.propriedade.grupo_cor;
        const allInGroup = toGroupMap.get(grupo) || [];
        const included = allInGroup.every((pid) => wantIds.has(pid));
        if (!included) {
          throw new AppError(
            400,
            `"${sp.posses.propriedade.nome}" tem casas. Você precisa solicitar TODAS as propriedades do grupo ${grupo} ou o dono vender as casas primeiro.`
          );
        }
      }
    }

    // Cria negociação
    const negotiation = await this.repo.createNegotiation({
      sessionId,
      fromPlayerId,
      toPlayerId,
    });

    // Cria items
    const dbItems: { sessionPossesId?: number | null; fromSide: boolean; valor?: number | null }[] =
      allItems.map((i) => ({
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

    // Agenda timeout
    const timer = setTimeout(async () => {
      try {
        const n = await this.repo.findNegotiationById(negotiation.id);
        if (n && n.status === "pendente") {
          await this.repo.updateNegotiationStatus(negotiation.id, "expirada");
          for (const item of n.items) {
            if (item.sessionPossesId && item.fromSide) {
              await this.repo.setNegociando(item.sessionPossesId, false);
            }
          }
          const { emitToPlayer } = await import("../../lib/socket.js");
          emitToPlayer(sessionId, n.fromPlayerId, "negotiation:expired", {
            negotiationId: n.id,
          });
          emitToPlayer(sessionId, n.toPlayerId, "negotiation:expired", {
            negotiationId: n.id,
          });
          negotiationTimers.delete(n.id);
        }
      } catch (err) {
        console.error("[Negociação] Erro no timeout:", err);
      }
    }, NEGOTIATION_TIMEOUT_MS);

    negotiationTimers.set(negotiation.id, timer);

    const result = await this.repo.findNegotiationById(negotiation.id);
    return result;
  }

  async aceitarNegociacao(negotiationId: number, playerId: number) {
    const negotiation = await this.repo.findNegotiationById(negotiationId);
    if (!negotiation) throw new AppError(404, "Negociação não encontrada!");
    if (negotiation.status !== "pendente") {
      throw new AppError(400, "Esta negociação não está mais pendente!");
    }
    if (negotiation.toPlayerId !== playerId) {
      throw new AppError(403, "Apenas o alvo pode aceitar esta negociação!");
    }

    // Cancela timeout
    this.clearTimer(negotiationId);

    const items = negotiation.items as { id: number; sessionPossesId: number | null; fromSide: boolean; valor: number | null }[];

    const offerProps = items.filter((i) => i.fromSide && i.sessionPossesId);
    const wantProps = items.filter((i) => !i.fromSide && i.sessionPossesId);

    const offerMoney = items
      .filter((i) => i.fromSide && i.valor)
      .reduce((acc: number, i) => acc + (i.valor ?? 0), 0);
    const wantMoney = items
      .filter((i) => !i.fromSide && i.valor)
      .reduce((acc: number, i) => acc + (i.valor ?? 0), 0);

    const netMoney = offerMoney - wantMoney; // fromPlayer paga se > 0, recebe se < 0

    const fromPlayer = await this.repo.findPlayerById(negotiation.fromPlayerId);
    const toPlayer = await this.repo.findPlayerById(negotiation.toPlayerId);
    if (!fromPlayer || !toPlayer) throw new AppError(404, "Jogador não encontrado!");

    if (netMoney > 0 && fromPlayer.saldo < netMoney) {
      throw new AppError(400, "Proponente não tem saldo suficiente!");
    }
    if (netMoney < 0 && toPlayer.saldo < Math.abs(netMoney)) {
      throw new AppError(400, "Alvo não tem saldo suficiente!");
    }

    const operacoes: any[] = [];

    // Transfere propriedades: offered (from → to), wanted (to → from)
    // Ao transferir, zera casas (quebra o monopólio do dono anterior)
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

    // Ajusta saldos (net)
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

    // Destrava props offered que não foram transferidas (só dinheiro)
    const allOfferPropIds = offerProps.map((i) => i.sessionPossesId!).filter((id): id is number => id != null);
    for (const propId of allOfferPropIds) {
      operacoes.push(
        prisma.sessionPosses.update({
          where: { id: propId },
          data: { negociando: false },
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
    if (negotiation.toPlayerId !== playerId) {
      throw new AppError(403, "Apenas o alvo pode recusar esta negociação!");
    }

    this.clearTimer(negotiationId);

    const operacoes: any[] = [];

    // Destrava offered
    for (const item of negotiation.items) {
      if (item.fromSide && item.sessionPossesId) {
        operacoes.push(
          prisma.sessionPosses.update({
            where: { id: item.sessionPossesId },
            data: { negociando: false },
          })
        );
      }
    }

    operacoes.push(
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

    await prisma.$transaction(operacoes);
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
    if (oldNegotiation.toPlayerId !== playerId) {
      throw new AppError(403, "Apenas o alvo pode contra-ofertar!");
    }

    this.clearTimer(negotiationId);

    // Destrava props antigas
    const unlockOps: any[] = [];
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

    // Cria nova negociação com papéis invertidos
    const newNegotiation = await this.criarNegociacao(
      oldNegotiation.sessionId,
      oldNegotiation.toPlayerId, // alvo vira proponente
      oldNegotiation.fromPlayerId, // proponente vira alvo
      newOfferItems,
      newWantItems
    );

    return newNegotiation;
  }

  async listarPendentes(sessionId: number, playerId: number) {
    return this.repo.findPendentesByPlayer(sessionId, playerId);
  }

  private buildGroupMap(props: any[]): Map<string, number[]> {
    const map = new Map<string, number[]>();
    for (const sp of props) {
      const grupo = sp.posses.propriedade.grupo_cor;
      if (!map.has(grupo)) map.set(grupo, []);
      map.get(grupo)!.push(sp.id);
    }
    return map;
  }

  private clearTimer(negotiationId: number) {
    const timer = negotiationTimers.get(negotiationId);
    if (timer) {
      clearTimeout(timer);
      negotiationTimers.delete(negotiationId);
    }
  }
}
