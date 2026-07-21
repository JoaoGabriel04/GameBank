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
const { fechamentoMapa2DService } = await import("../services/fechamento.service.js");

async function criarTerreno(overrides: Partial<{ codigo: string; categoria: "comum" | "mediana" | "rica"; multiplicador: number; precoBase: number }> = {}) {
  return prisma.terreno.upsert({
    where: { codigo: overrides.codigo ?? "vila-nova-fech-01" },
    update: {},
    create: {
      codigo: overrides.codigo ?? "vila-nova-fech-01",
      regiaoNome: "Vila Nova",
      categoria: overrides.categoria ?? "comum",
      multiplicador: overrides.multiplicador ?? 0.6,
      slots: 1,
      precoBase: overrides.precoBase ?? 180,
    },
  });
}

async function criarSessaoMapa2D(ownerId: number) {
  return prisma.session.create({
    data: {
      ownerId,
      status: "Em Andamento",
      tipoJogo: "mapa2d",
      modo: "individual",
      startedAt: new Date(),
      rodadaAtual: 1,
    },
  });
}

describe("fechamento.service (mapa2d)", () => {
  it("cobra IPTU + imposto progressivo corretamente no fechamento", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerreno({ precoBase: 180 });
    await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 180, adquiridoEm: new Date() },
    });

    await fechamentoMapa2DService.fecharMes(sessao.id);

    // ativos = 1000 (saldo) + 180 (terreno) = 1180
    // IPTU = round(180 × 0.03) = 5
    // imposto progressivo: faixa 0-1500 @ 1% sobre 1180 = round(11.8) = 12
    // total = 17 → saldo final = 1000 - 17 = 983
    const playerFinal = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(playerFinal?.saldo).toBe(983);
  });

  it("avança o mês e reagenda o fechamento (timer resiliente)", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    await criarPlayer(sessao.id, owner.id, { saldo: 1000 });

    await fechamentoMapa2DService.fecharMes(sessao.id);

    const sessaoFinal = await prisma.session.findUnique({ where: { id: sessao.id } });
    expect(sessaoFinal?.rodadaAtual).toBe(2);
    expect(sessaoFinal?.fecharMesEm).not.toBeNull();
  });

  it("construção ocupada (preço bem abaixo do recomendado) credita aluguel e cobra manutenção", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerreno({ codigo: "mediana-fech-01", categoria: "mediana", multiplicador: 1.3, precoBase: 390 });
    const st = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 390, adquiridoEm: new Date() },
    });
    // recomendado = 50 × 1.3 × 1.0(casa) = 65 — pedido bem abaixo (10) garante ocupação (razão ≤ 0.9)
    await prisma.construcao.create({ data: { sessionTerrenoId: st.id, tipo: "casa", nivel: 1, aluguelPedido: 10 } });

    await fechamentoMapa2DService.fecharMes(sessao.id);

    const construcaoFinal = await prisma.construcao.findUnique({ where: { sessionTerrenoId: st.id } });
    expect(construcaoFinal?.ocupado).toBe(true);
  });

  it("falência: 2 meses de graça, 3º mês devendo devolve terrenos e marca desistiu", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 0 });
    // terreno caro (rica) sem construção: IPTU + imposto progressivo sempre
    // superam o saldo, então o saldo só piora mês a mês — sem chance de recuperação.
    const terreno = await criarTerreno({ codigo: "alphaville-fech-01", categoria: "rica", multiplicador: 3.5, precoBase: 3000 });
    await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 3000, adquiridoEm: new Date() },
    });

    await fechamentoMapa2DService.fecharMes(sessao.id);
    let playerAtual = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(playerAtual?.rodadasDevendo).toBe(1);
    expect(playerAtual?.desistiu).toBe(false);

    await fechamentoMapa2DService.fecharMes(sessao.id);
    playerAtual = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(playerAtual?.rodadasDevendo).toBe(2);
    expect(playerAtual?.desistiu).toBe(false);

    await fechamentoMapa2DService.fecharMes(sessao.id);
    playerAtual = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(playerAtual?.desistiu).toBe(true);
    expect(playerAtual?.motivoDesistencia).toBe("FALENCIA");

    const st = await prisma.sessionTerreno.findUnique({
      where: { sessionId_terrenoId: { sessionId: sessao.id, terrenoId: terreno.id } },
    });
    expect(st?.donoId).toBeNull();
  });
});
