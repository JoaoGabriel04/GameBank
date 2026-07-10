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
};
