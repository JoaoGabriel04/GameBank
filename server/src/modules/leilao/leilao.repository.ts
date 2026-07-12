import { prisma } from "../../lib/prisma.js";

export const leilaoRepository = {
  criarLance: (data: { sessionId: number; propId: number; playerId: number; valor: number }) =>
    prisma.leilaoLance.create({ data }),

  findLance: (sessionId: number, propId: number, playerId: number) =>
    prisma.leilaoLance.findUnique({
      where: { sessionId_propId_playerId: { sessionId, propId, playerId } },
    }),

  findLances: (sessionId: number, propId: number) =>
    prisma.leilaoLance.findMany({ where: { sessionId, propId } }),

  contarLances: (sessionId: number, propId: number) =>
    prisma.leilaoLance.count({ where: { sessionId, propId } }),

  limparLances: (sessionId: number, propId: number) =>
    prisma.leilaoLance.deleteMany({ where: { sessionId, propId } }),

  // Jogadores ainda ativos na sessão (não desistiram) — usado para saber
  // se todos já deram lance e o leilão pode encerrar antes do timeout.
  contarJogadoresAtivos: (sessionId: number) =>
    prisma.sessionPlayer.count({ where: { sessionId, desistiu: false } }),
};
