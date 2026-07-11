import { prisma } from "../../lib/prisma.js";

export const turnoRepository = {
  findSessionsStuck: () =>
    prisma.session.findMany({
      where: {
        status: "Em Andamento",
        tipoJogo: "tabuleiro",
        turnoIniciadoEm: { not: null },
        turnoAtualPlayerId: { not: null },
      },
      select: {
        id: true,
        turnoIniciadoEm: true,
        jogadores: {
          select: { id: true, userId: true, nome: true, desistiu: true, pularProximaRodada: true, emPrisao: true },
        },
      },
    }),

  findSessionComJogadores: (sessionId: number) =>
    prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        tipoJogo: true,
        turnoAtualPlayerId: true,
        ordemTurnos: true,
        turnoIniciadoEm: true,
        aguardandoAcao: true,
        jogadores: {
          select: {
            id: true,
            userId: true,
            nome: true,
            desistiu: true,
            pularProximaRodada: true,
            emPrisao: true,
          },
        },
      },
    }),

  updateTurno: (sessionId: number, data: {
    turnoAtualPlayerId?: number | null;
    turnoIniciadoEm?: Date | null;
    ordemTurnos?: string | null;
    aguardandoAcao?: boolean;
  }) =>
    prisma.session.update({ where: { id: sessionId }, data }),

  clearPularProximaRodada: (playerId: number) =>
    prisma.sessionPlayer.update({
      where: { id: playerId },
      data: { pularProximaRodada: false },
    }),

  findPlayerParaJogada: (playerId: number) =>
    prisma.sessionPlayer.findUnique({
      where: { id: playerId },
      select: {
        id: true, sessionId: true, nome: true, posicao: true, saldo: true,
        emPrisao: true, desistiu: true, pularProximaRodada: true,
        turnosPrisao: true, tentativasPrisao: true,
      },
    }),

  moverPlayer: (playerId: number, data: {
    posicao?: number; saldo?: number; emPrisao?: boolean; turnosPrisao?: number;
    tentativasPrisao?: number; pularProximaRodada?: boolean;
  }) =>
    prisma.sessionPlayer.update({ where: { id: playerId }, data }),

  registrarDados: (sessionId: number, data: { ultimoDado1: number; ultimoDado2: number; aguardandoAcao: boolean }) =>
    prisma.session.update({ where: { id: sessionId }, data }),

  setAguardandoAcao: (sessionId: number, aguardandoAcao: boolean) =>
    prisma.session.update({ where: { id: sessionId }, data: { aguardandoAcao } }),

  criarDivida: (data: { sessionId: number; playerId: number; valor: number; descricao: string }) =>
    prisma.debt.create({ data }),

  criarHistorico: (data: { sessionId: number; tipo: string; detalhes: string }) =>
    prisma.historico.create({ data: { ...data, data: new Date() } }),
};
