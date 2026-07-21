import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../lib/socket.js", () => ({
  getIO: jest.fn(),
  initSocket: jest.fn(),
  emitToRoom: jest.fn(),
  emitToUser: jest.fn(async () => true),
  emitToUserWithRetry: jest.fn(async () => true),
  emitToPlayer: jest.fn(),
  emitChatMessage: jest.fn(),
}));

const { prisma } = await import("../../../lib/prisma.js");
const { criarUsuario, criarPlayer } = await import("../../../__tests__/helpers/factories.js");
const { mapa2dService } = await import("../mapa2d.service.js");

async function criarSessaoMapa2D(ownerId: number) {
  return prisma.session.create({
    data: {
      ownerId,
      status: "Em Andamento",
      tipoJogo: "mapa2d",
      modo: "individual",
      startedAt: new Date(),
      rodadaAtual: 24,
    },
  });
}

async function criarJogadorComPatrimonio(sessionId: number, ownerId: number | null, nome: string, saldo: number, reputacao: number) {
  const player = await criarPlayer(sessionId, ownerId, { saldo, nome, cor: nome });
  await prisma.sessionPlayer.update({ where: { id: player.id }, data: { reputacao } });
  return player;
}

describe("mapa2d.service — Fatia 2: desempate de vitória por Reputação", () => {
  it("diferença de patrimônio GRANDE → Reputação não interfere, vence quem tem mais patrimônio", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const p1 = await criarJogadorComPatrimonio(sessao.id, owner.id, "P1", 10000, 1.0);
    await criarJogadorComPatrimonio(sessao.id, null, "P2", 1000, 5.0);

    const { ranking } = await mapa2dService.encerrarPartida(sessao.id);
    expect(ranking[0].playerId).toBe(p1.id);
  });

  it("diferença PEQUENA, só um com Reputação ≥ 4.0 → esse vence mesmo com patrimônio menor", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    await criarJogadorComPatrimonio(sessao.id, owner.id, "P1", 1000, 2.0);
    const p2 = await criarJogadorComPatrimonio(sessao.id, null, "P2", 950, 4.5);

    const { ranking } = await mapa2dService.encerrarPartida(sessao.id);
    expect(ranking[0].playerId).toBe(p2.id);
  });

  it("diferença PEQUENA, AMBOS ≥ 4.0 → vence quem tem a MAIOR Reputação", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    await criarJogadorComPatrimonio(sessao.id, owner.id, "P1", 1000, 4.2);
    const p2 = await criarJogadorComPatrimonio(sessao.id, null, "P2", 950, 4.8);

    const { ranking } = await mapa2dService.encerrarPartida(sessao.id);
    expect(ranking[0].playerId).toBe(p2.id);
  });

  it("diferença PEQUENA, NENHUM ≥ 4.0 → mantém o critério normal de patrimônio", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const p1 = await criarJogadorComPatrimonio(sessao.id, owner.id, "P1", 1000, 3.0);
    await criarJogadorComPatrimonio(sessao.id, null, "P2", 950, 3.5);

    const { ranking } = await mapa2dService.encerrarPartida(sessao.id);
    expect(ranking[0].playerId).toBe(p1.id);
  });
});
