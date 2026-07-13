import { jest } from "@jest/globals";

jest.unstable_mockModule("../../lib/socket.js", () => ({
  getIO: jest.fn(),
  initSocket: jest.fn(),
  emitToRoom: jest.fn(),
  emitToUser: jest.fn(async () => true),
  emitToUserWithRetry: jest.fn(async () => true),
  emitToPlayer: jest.fn(),
  emitChatMessage: jest.fn(),
}));
jest.unstable_mockModule("../../modules/socket/socket.handler.js", () => ({
  emitSessionUpdated: jest.fn(),
  emitSessionClosed: jest.fn(),
  emitChatMessage: jest.fn(),
  emitNotificationNew: jest.fn(),
  emitUpdatedSession: jest.fn(async () => {}),
  emitTurnoTimeout: jest.fn(),
}));

const { prisma } = await import("../../lib/prisma.js");
const { criarUsuario, criarSessao, criarPlayer } = await import("../helpers/factories.js");
const { turnoService } = await import("../../modules/turno/turno.service.js");
const { RENDA_PASSIVA_PCT } = await import("../../constants/economia.js");

describe("Renda passiva por rodada", () => {
  it("credita a renda passiva de todos os jogadores ativos a cada virada de rodada", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    await prisma.session.update({ where: { id: sessao.id }, data: { tipoJogo: "tabuleiro" } });
    const p1 = await criarPlayer(sessao.id, owner.id, { nome: "P1", saldo: 25000 });
    const p2 = await criarPlayer(sessao.id, null, { nome: "P2", cor: "Vermelho", saldo: 25000 });

    // upsert (não create): Propriedade.id não é auto-increment, então um
    // id fixo de teste colide com a mesma linha deixada por uma execução
    // anterior da suíte contra o mesmo banco de teste.
    const propriedade = await prisma.propriedade.upsert({
      where: { id: 900001 },
      create: {
        id: 900001,
        nome: "Propriedade de Teste",
        grupo_cor: "azul",
        tipo: "normal",
        custo_compra: 2000,
        aluguel_base: 100,
        aluguel_1c: 200,
        aluguel_2c: 300,
        aluguel_3c: 400,
        aluguel_4c: 500,
        aluguel_hotel: 600,
        custo_casa: 500,
        hipoteca: 1000,
      },
      update: {},
    });

    await prisma.sessionPosses.create({
      data: { sessionId: sessao.id, propId: propriedade.id, playerId: p1.id, casas: 0, hipotecada: false },
    });

    const { turnoAtualPlayerId } = await turnoService.iniciarTurnos(sessao.id, [p1.id, p2.id]);
    const outroId = turnoAtualPlayerId === p1.id ? p2.id : p1.id;

    // Com 2 jogadores, 2 passes de vez completam uma volta e viram a rodada.
    await turnoService.passarVez(sessao.id, turnoAtualPlayerId!);
    await turnoService.passarVez(sessao.id, outroId);

    const sessaoFinal = await prisma.session.findUniqueOrThrow({ where: { id: sessao.id } });
    expect(sessaoFinal.rodadaAtual).toBeGreaterThanOrEqual(2);

    const p1Final = await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: p1.id } });
    const rendaEsperada = Math.round(propriedade.aluguel_base * RENDA_PASSIVA_PCT);
    expect(p1Final.saldo).toBe(25000 + rendaEsperada);

    const historico = await prisma.historico.findFirst({
      where: { sessionId: sessao.id, tipo: "RENDA_PASSIVA" },
    });
    expect(historico).not.toBeNull();
  });
});
