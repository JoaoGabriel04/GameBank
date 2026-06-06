import { jest } from "@jest/globals";

// Mocka os módulos de Socket.IO: os controllers do banco emitem eventos após a
// mutação, e getIO() lança erro sem socket inicializado. Como não inicializamos
// socket nos testes, as emissões viram no-op.
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
}));

const request = (await import("supertest")).default;
const { createTestApp } = await import("../helpers/test-app.js");
const { prisma } = await import("../../lib/prisma.js");
const { criarUsuario, criarSessao, criarPlayer, gerarToken } = await import("../helpers/factories.js");

const app = createTestApp();

describe("Transferência bancária (SessionPlayer.saldo)", () => {
  it("debita do pagador e credita no recebedor atomicamente", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const pagador = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const recebedor = await criarPlayer(sessao.id, null, { saldo: 500, nome: "P2", cor: "Vermelho" });
    const token = gerarToken(owner);

    await request(app)
      .put("/api/banco/transferencia")
      .set("Authorization", `Bearer ${token}`)
      .send({ pagadorId: pagador.id, recebedorId: recebedor.id, sessionId: sessao.id, valor: 200 })
      .expect(200);

    const p1 = await prisma.sessionPlayer.findUnique({ where: { id: pagador.id } });
    const p2 = await prisma.sessionPlayer.findUnique({ where: { id: recebedor.id } });
    expect(p1?.saldo).toBe(800); // 1000 - 200
    expect(p2?.saldo).toBe(700); // 500 + 200
  });

  it("rejeita se a rota não tiver autenticação", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const pagador = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const recebedor = await criarPlayer(sessao.id, null, { saldo: 0, nome: "P2", cor: "Verde-Escuro" });

    await request(app)
      .put("/api/banco/transferencia")
      .send({ pagadorId: pagador.id, recebedorId: recebedor.id, sessionId: sessao.id, valor: 100 })
      .expect(401);
  });
});

describe("Saque valida saldo no backend", () => {
  // O saque é a operação do GameBank que valida saldo insuficiente (a
  // transferência entre jogadores não bloqueia — semântica de Banco Imobiliário).
  it("rejeita saque com saldo insuficiente e não altera o saldo", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 100 });
    const token = gerarToken(owner);

    await request(app)
      .put("/api/banco/saque")
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: player.id, sessionId: sessao.id, valor: 500 })
      .expect(400);

    const unchanged = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(unchanged?.saldo).toBe(100); // inalterado
  });
});
