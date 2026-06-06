import { jest } from "@jest/globals";

// Mock do Prisma (teste unitário puro — sem banco). Adaptado ao reward.service
// real: a atividade usa sessionPosses/negotiation/debt (não transaction/propertyAction).
jest.unstable_mockModule("../../lib/prisma.js", () => ({
  prisma: {
    gameResult: {
      findFirst: jest.fn(async () => null), // sem cooldown
      aggregate: jest.fn(async () => ({ _sum: { coinsEarned: 0, xpEarned: 0 } })), // sem cap
    },
    sessionPosses: { count: jest.fn(async () => 3) },
    negotiation: { count: jest.fn(async () => 1) },
    debt: { count: jest.fn(async () => 5) },
  },
}));

const { calcularRecompensa } = await import("../../modules/session/reward.service.js");

describe("calcularRecompensa", () => {
  // playerId é exigido pelo reward.service real (mede atividade por SessionPlayer)
  const baseInput = { userId: 1, playerId: 1, sessionId: 1, position: 1, patrimony: 25000 };

  it("não credita se a partida durou menos de 5 minutos", async () => {
    const r = await calcularRecompensa({
      ...baseInput,
      sessionStartedAt: new Date(Date.now() - 3 * 60 * 1000),
    });
    expect(r.coins).toBe(0);
    expect(r.xp).toBe(0);
    expect(r.penaltyReason).toMatch(/curta/i);
  });

  it("credita recompensa base para 1º lugar em partida normal (15min)", async () => {
    const r = await calcularRecompensa({
      ...baseInput,
      position: 1,
      sessionStartedAt: new Date(Date.now() - 15 * 60 * 1000),
    });
    expect(r.coins).toBe(100);
    expect(r.xp).toBe(90);
    expect(r.multiplier).toBe(1.0);
  });

  it("aplica bônus de duração para partidas longas (45min → ×1.2)", async () => {
    const r = await calcularRecompensa({
      ...baseInput,
      position: 1,
      sessionStartedAt: new Date(Date.now() - 45 * 60 * 1000),
    });
    expect(r.coins).toBe(120); // 100 * 1.2
    expect(r.multiplier).toBe(1.2);
  });

  it("não credita para posição fora do top 3", async () => {
    const r = await calcularRecompensa({
      ...baseInput,
      position: 4,
      sessionStartedAt: new Date(Date.now() - 20 * 60 * 1000),
    });
    expect(r.coins).toBe(0);
    expect(r.xp).toBe(0);
  });
});
