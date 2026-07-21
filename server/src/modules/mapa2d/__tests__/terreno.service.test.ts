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
const { criarUsuario, criarSessao, criarPlayer } = await import("../../../__tests__/helpers/factories.js");
const { terrenoMapa2DService } = await import("../services/terreno.service.js");

async function criarTerreno(overrides: Partial<{ codigo: string; precoBase: number; categoria: "comum" | "mediana" | "rica"; multiplicador: number }> = {}) {
  return prisma.terreno.upsert({
    where: { codigo: overrides.codigo ?? "vila-nova-01" },
    update: {},
    create: {
      codigo: overrides.codigo ?? "vila-nova-01",
      regiaoNome: "Vila Nova",
      categoria: overrides.categoria ?? "comum",
      multiplicador: overrides.multiplicador ?? 0.6,
      slots: 1,
      precoBase: overrides.precoBase ?? 180,
    },
  });
}

async function criarSessionTerreno(sessionId: number, terrenoId: number) {
  return prisma.sessionTerreno.create({ data: { sessionId, terrenoId } });
}

function contarResultados(results: PromiseSettledResult<any>[]) {
  const sucesso = results.filter((r) => r.status === "fulfilled").length;
  const falha = results.filter((r) => r.status === "rejected").length;
  return { sucesso, falha };
}

describe("terreno.service (mapa2d) — compra de terreno", () => {
  it("compra debita o preço correto e marca o dono", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id, { saldoInicial: 1000 });
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerreno({ precoBase: 180 });
    await criarSessionTerreno(sessao.id, terreno.id);

    const result = await terrenoMapa2DService.comprarTerreno(sessao.id, player.id, terreno.id);
    expect(result.precoPago).toBe(180);

    const playerFinal = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(playerFinal?.saldo).toBe(820);

    const st = await prisma.sessionTerreno.findUnique({ where: { sessionId_terrenoId: { sessionId: sessao.id, terrenoId: terreno.id } } });
    expect(st?.donoId).toBe(player.id);
    expect(st?.precoPago).toBe(180);
  });

  it("recusa comprar terreno que já tem dono", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const p1 = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const p2 = await criarPlayer(sessao.id, null, { saldo: 1000, nome: "P2", cor: "Vermelho" });
    const terreno = await criarTerreno({ codigo: "vila-nova-02" });
    await criarSessionTerreno(sessao.id, terreno.id);

    await terrenoMapa2DService.comprarTerreno(sessao.id, p1.id, terreno.id);

    await expect(terrenoMapa2DService.comprarTerreno(sessao.id, p2.id, terreno.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("recusa comprar com saldo insuficiente", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 100 });
    const terreno = await criarTerreno({ codigo: "vila-nova-03", precoBase: 180 });
    await criarSessionTerreno(sessao.id, terreno.id);

    await expect(terrenoMapa2DService.comprarTerreno(sessao.id, player.id, terreno.id)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("CONCORRÊNCIA REAL: N requisições simultâneas no mesmo terreno — exatamente 1 sucede", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const terreno = await criarTerreno({ codigo: "vila-nova-04", precoBase: 180 });
    await criarSessionTerreno(sessao.id, terreno.id);

    const N = 8;
    const players = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        criarPlayer(sessao.id, null, { saldo: 1000, nome: `P${i}`, cor: `Cor${i}` })
      )
    );

    const results = await Promise.allSettled(
      players.map((p) => terrenoMapa2DService.comprarTerreno(sessao.id, p.id, terreno.id))
    );

    const { sucesso, falha } = contarResultados(results);
    expect(sucesso).toBe(1);
    expect(falha).toBe(N - 1);

    const st = await prisma.sessionTerreno.findUnique({
      where: { sessionId_terrenoId: { sessionId: sessao.id, terrenoId: terreno.id } },
    });
    expect(st?.donoId).not.toBeNull();

    // Só o vencedor teve o saldo debitado.
    const saldosFinais = await prisma.sessionPlayer.findMany({ where: { sessionId: sessao.id } });
    const comSaldoDebitado = saldosFinais.filter((p) => p.saldo === 820);
    expect(comSaldoDebitado).toHaveLength(1);
  });
});
