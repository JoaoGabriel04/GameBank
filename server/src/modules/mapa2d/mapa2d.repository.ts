import { prisma } from "../../lib/prisma.js";

export const mapa2dRepository = {
  findPlayer: (playerId: number) =>
    prisma.sessionPlayer.findUnique({ where: { id: playerId } }),

  findPlayers: (sessionId: number) =>
    prisma.sessionPlayer.findMany({ where: { sessionId } }),

  findPlayersAtivos: (sessionId: number) =>
    prisma.sessionPlayer.findMany({ where: { sessionId, desistiu: false } }),

  findTerreno: (terrenoId: number) =>
    prisma.terreno.findUnique({ where: { id: terrenoId } }),

  findTerrenosPorCategoria: (categoria: "comum" | "mediana" | "rica") =>
    prisma.terreno.findMany({ where: { categoria } }),

  findTodosTerrenos: () => prisma.terreno.findMany(),

  findSessionTerreno: (sessionId: number, terrenoId: number) =>
    prisma.sessionTerreno.findUnique({
      where: { sessionId_terrenoId: { sessionId, terrenoId } },
      include: { terreno: true },
    }),

  findSessionTerrenoById: (sessionTerrenoId: number) =>
    prisma.sessionTerreno.findUnique({
      where: { id: sessionTerrenoId },
      include: { terreno: true, construcao: true },
    }),

  criarSessionTerrenos: (
    data: { sessionId: number; terrenoId: number }[]
  ) => prisma.sessionTerreno.createMany({ data }),

  findConstrucaoDoJogador: (construcaoId: number, playerId: number) =>
    prisma.construcao.findFirst({
      where: { id: construcaoId, sessionTerreno: { donoId: playerId } },
      include: { sessionTerreno: { include: { terreno: true } } },
    }),

  findConstrucoesComDono: (sessionId: number) =>
    prisma.construcao.findMany({
      where: { sessionTerreno: { sessionId, donoId: { not: null } } },
      include: { sessionTerreno: { include: { terreno: true } } },
    }),

  criarHistorico: (sessionId: number, tipo: string, detalhes: string) =>
    prisma.historico.create({ data: { sessionId, data: new Date(), tipo, detalhes } }),

  findSessionAtiva: (sessionId: number) =>
    prisma.session.findFirst({
      where: { id: sessionId, status: "Em Andamento", tipoJogo: "mapa2d" },
    }),

  findSessoesMapa2DComFechamentoPendente: () =>
    prisma.session.findMany({
      where: { status: "Em Andamento", tipoJogo: "mapa2d", fecharMesEm: { not: null } },
      select: { id: true, fecharMesEm: true },
    }),

  updateSession: (
    sessionId: number,
    data: { rodadaAtual?: number; fecharMesEm?: Date | null; status?: string }
  ) => prisma.session.update({ where: { id: sessionId }, data }),

  updatePlayerSaldo: (playerId: number, delta: number) =>
    prisma.sessionPlayer.update({
      where: { id: playerId },
      data: { saldo: { increment: delta } },
    }),

  findDebtAberta: (sessionId: number, playerId: number) =>
    prisma.debt.findFirst({ where: { sessionId, playerId, pago: false } }),

  criarDebt: (sessionId: number, playerId: number, valor: number, descricao: string) =>
    prisma.debt.create({ data: { sessionId, playerId, valor, descricao } }),

  incrementarDebt: (debtId: number, valor: number) =>
    prisma.debt.update({ where: { id: debtId }, data: { valor: { increment: valor } } }),

  updatePlayerRodadasDevendo: (playerId: number, rodadasDevendo: number) =>
    prisma.sessionPlayer.update({ where: { id: playerId }, data: { rodadasDevendo } }),

  marcarFalido: (playerId: number) =>
    prisma.sessionPlayer.update({
      where: { id: playerId },
      data: { desistiu: true, motivoDesistencia: "FALENCIA", desistiuEm: new Date(), saldo: 0 },
    }),

  liberarTerrenosDoJogador: (sessionId: number, playerId: number) =>
    prisma.sessionTerreno.updateMany({
      where: { sessionId, donoId: playerId },
      data: { donoId: null, precoPago: null, adquiridoEm: null },
    }),

  removerConstrucoesDoJogador: (sessionId: number, playerId: number) =>
    prisma.construcao.deleteMany({
      where: { sessionTerreno: { sessionId, donoId: playerId } },
    }),

  findSessionTerrenosComDono: (sessionId: number, playerId: number) =>
    prisma.sessionTerreno.findMany({
      where: { sessionId, donoId: playerId },
      include: { construcao: true },
    }),
};
