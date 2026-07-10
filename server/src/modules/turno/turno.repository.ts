import { prisma } from "../../lib/prisma.js";

export const turnoRepository = {
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
      select: { id: true, sessionId: true, posicao: true, saldo: true, emPrisao: true, desistiu: true },
    }),

  moverPlayer: (playerId: number, data: { posicao: number; saldo?: number; emPrisao?: boolean; turnosPrisao?: number }) =>
    prisma.sessionPlayer.update({ where: { id: playerId }, data }),

  registrarDados: (sessionId: number, data: { ultimoDado1: number; ultimoDado2: number; aguardandoAcao: boolean }) =>
    prisma.session.update({ where: { id: sessionId }, data }),
};
