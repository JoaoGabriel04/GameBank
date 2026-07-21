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
const { construcaoMapa2DService } = await import("../services/construcao.service.js");
const { economiaMapa2DService } = await import("../services/economia.service.js");

async function criarTerreno(overrides: Partial<{ codigo: string; categoria: "comum" | "mediana" | "rica"; multiplicador: number }> = {}) {
  return prisma.terreno.upsert({
    where: { codigo: overrides.codigo ?? "mediana-01" },
    update: {},
    create: {
      codigo: overrides.codigo ?? "mediana-01",
      regiaoNome: "Mascherano",
      categoria: overrides.categoria ?? "mediana",
      multiplicador: overrides.multiplicador ?? 1.3,
      slots: 1,
      precoBase: 390,
    },
  });
}

function contarResultados(results: PromiseSettledResult<any>[]) {
  const sucesso = results.filter((r) => r.status === "fulfilled").length;
  const falha = results.filter((r) => r.status === "rejected").length;
  return { sucesso, falha };
}

async function criarSessionTerrenoComDono(sessionId: number, terrenoId: number, donoId: number) {
  return prisma.sessionTerreno.create({
    data: { sessionId, terrenoId, donoId, precoPago: 390, adquiridoEm: new Date() },
  });
}

describe("construcao.service (mapa2d)", () => {
  it("construir debita slots × 120 e cria a construção nível 1", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerreno();
    const st = await criarSessionTerrenoComDono(sessao.id, terreno.id, player.id);

    const result = await construcaoMapa2DService.construir(sessao.id, player.id, st.id, "casa");
    expect(result.custo).toBe(120); // 1 slot × 120

    const playerFinal = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(playerFinal?.saldo).toBe(880);

    const construcao = await prisma.construcao.findUnique({ where: { sessionTerrenoId: st.id } });
    expect(construcao?.tipo).toBe("casa");
    expect(construcao?.nivel).toBe(1);
  });

  it("recusa construir em terreno de outro jogador", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const p1 = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const p2 = await criarPlayer(sessao.id, null, { saldo: 1000, nome: "P2", cor: "Vermelho" });
    const terreno = await criarTerreno({ codigo: "mediana-02" });
    const st = await criarSessionTerrenoComDono(sessao.id, terreno.id, p1.id);

    await expect(construcaoMapa2DService.construir(sessao.id, p2.id, st.id, "casa")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("CONCORRÊNCIA REAL: duas construções simultâneas no mesmo terreno — só 1 sucede", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerreno({ codigo: "mediana-03" });
    const st = await criarSessionTerrenoComDono(sessao.id, terreno.id, player.id);

    const results = await Promise.allSettled([
      construcaoMapa2DService.construir(sessao.id, player.id, st.id, "casa"),
      construcaoMapa2DService.construir(sessao.id, player.id, st.id, "sobrado"),
    ]);

    const { sucesso, falha } = contarResultados(results);
    expect(sucesso).toBe(1);
    expect(falha).toBe(1);

    const construcoes = await prisma.construcao.findMany({ where: { sessionTerrenoId: st.id } });
    expect(construcoes).toHaveLength(1);
  });

  it("aluguel recomendado segue a fórmula base × mult_região × mult_tipo", () => {
    // base_regiao = RENDA_BASE_REF(50) × multiplicador; mult_construcao: casa=1.0, hotel=3.0
    const recomendadoCasa = economiaMapa2DService.calcularAluguelRecomendado(1.3, "casa" as any);
    expect(recomendadoCasa).toBe(Math.round(50 * 1.3 * 1.0));

    const recomendadoHotel = economiaMapa2DService.calcularAluguelRecomendado(1.3, "hotel" as any);
    expect(recomendadoHotel).toBe(Math.round(50 * 1.3 * 3.0));
  });

  it("ocupação: preço ≤ 90% do justo sempre ocupa; muito acima da sensibilidade quase nunca ocupa", () => {
    const recomendado = 100;
    for (let i = 0; i < 20; i++) {
      expect(economiaMapa2DService.calcularOcupacao(85, recomendado, "mediana")).toBe(true);
    }
    // razao=2.0 >= 1+sens(comum=0.15) → prob mínima (5%). Em 300 tentativas,
    // a taxa de ocupação deve ficar bem abaixo do preço-justo (limiar folgado
    // pra evitar flakiness — não é um teste de exatidão estatística).
    let ocupacoes = 0;
    const tentativas = 300;
    for (let i = 0; i < tentativas; i++) {
      if (economiaMapa2DService.calcularOcupacao(200, recomendado, "comum")) ocupacoes++;
    }
    expect(ocupacoes / tentativas).toBeLessThan(0.15);
  });
});
