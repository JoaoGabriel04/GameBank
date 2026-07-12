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
        aguardandoEscolha: true,
        ultimoDado1: true,
        ultimoDado2: true,
        rodadaAtual: true,
        eventoAtual: true,
        eventoProximo: true,
        eventoRodadasRestantes: true,
        emLeilao: true,
        leilaoPropId: true,
        leilaoIniciadoEm: true,
        leilaoLanceMinimo: true,
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

  // Sessões com leilão em andamento — usado pela varredura periódica
  // (mesmo padrão de findSessionsStuck para o timer de turno).
  findSessionsEmLeilao: () =>
    prisma.session.findMany({
      where: { status: "Em Andamento", tipoJogo: "tabuleiro", emLeilao: true },
      select: { id: true, leilaoIniciadoEm: true },
    }),

  updateTurno: (sessionId: number, data: {
    turnoAtualPlayerId?: number | null;
    turnoIniciadoEm?: Date | null;
    ordemTurnos?: string | null;
    aguardandoAcao?: boolean;
  }) =>
    prisma.session.update({ where: { id: sessionId }, data }),

  updateLeilao: (sessionId: number, data: {
    emLeilao?: boolean;
    leilaoPropId?: number | null;
    leilaoIniciadoEm?: Date | null;
    leilaoLanceMinimo?: number | null;
  }) =>
    prisma.session.update({ where: { id: sessionId }, data }),

  incrementRodada: (sessionId: number) =>
    prisma.session.update({
      where: { id: sessionId },
      data: { rodadaAtual: { increment: 1 } },
    }),

  updateEvento: (sessionId: number, data: { eventoAtual?: string | null; eventoProximo?: string | null; eventoRodadasRestantes?: number }) =>
    prisma.session.update({ where: { id: sessionId }, data }),

  findEventoAtual: (sessionId: number) =>
    prisma.session.findUnique({ where: { id: sessionId }, select: { eventoAtual: true } }),

  // Injeção de Liquidez: credita todos os jogadores ainda ativos na sessão.
  creditarTodosAtivos: (sessionId: number, valor: number) =>
    prisma.sessionPlayer.updateMany({
      where: { sessionId, desistiu: false },
      data: { saldo: { increment: valor } },
    }),

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
        turnosPrisao: true, tentativasPrisao: true, userId: true,
      },
    }),

  findPlayer: (playerId: number) =>
    prisma.sessionPlayer.findUnique({
      where: { id: playerId },
      select: { id: true, sessionId: true, nome: true, saldo: true, userId: true },
    }),

  moverPlayer: (playerId: number, data: {
    posicao?: number; saldo?: number; emPrisao?: boolean; turnosPrisao?: number;
    tentativasPrisao?: number; pularProximaRodada?: boolean;
  }) =>
    prisma.sessionPlayer.update({ where: { id: playerId }, data }),

  registrarDados: (sessionId: number, data: {
    ultimoDado1?: number; ultimoDado2?: number;
    aguardandoAcao?: boolean; aguardandoEscolha?: boolean;
  }) =>
    prisma.session.update({ where: { id: sessionId }, data }),

  setAguardandoAcao: (sessionId: number, aguardandoAcao: boolean) =>
    prisma.session.update({ where: { id: sessionId }, data: { aguardandoAcao } }),

  criarDivida: (data: { sessionId: number; playerId: number; valor: number; descricao: string }) =>
    prisma.debt.create({ data }),

  criarHistorico: (data: { sessionId: number; tipo: string; detalhes: string }) =>
    prisma.historico.create({ data: { ...data, data: new Date() } }),
};
