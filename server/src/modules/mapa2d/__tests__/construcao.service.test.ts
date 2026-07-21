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

  it("aluguel recomendado segue a fórmula base × mult_região × mult_tipo × mercado × inflação", () => {
    // base_regiao = RENDA_BASE_REF(50) × multiplicador; mult_construcao: casa=1.0, hotel=3.0
    // mercado=1.0, inflação=0 → neutro (mesmo resultado da Fatia 1)
    const recomendadoCasa = economiaMapa2DService.calcularAluguelRecomendado(1.3, "casa" as any, 1.0, 0);
    expect(recomendadoCasa).toBe(Math.round(50 * 1.3 * 1.0));

    const recomendadoHotel = economiaMapa2DService.calcularAluguelRecomendado(1.3, "hotel" as any, 1.0, 0);
    expect(recomendadoHotel).toBe(Math.round(50 * 1.3 * 3.0));

    // Boom (mercado 1.35) sobe o recomendado; inflação acumulada (0.08) também.
    const recomendadoBoom = economiaMapa2DService.calcularAluguelRecomendado(1.3, "casa" as any, 1.35, 0);
    expect(recomendadoBoom).toBe(Math.round(50 * 1.3 * 1.0 * 1.35));

    const recomendadoInflacao = economiaMapa2DService.calcularAluguelRecomendado(1.3, "casa" as any, 1.0, 0.08);
    expect(recomendadoInflacao).toBe(Math.round(50 * 1.3 * 1.0 * 1.08));
  });

  it("ocupação: preço ≤ 90% do justo sempre ocupa; muito acima da sensibilidade quase nunca ocupa (reputação neutra)", () => {
    const recomendado = 100;
    for (let i = 0; i < 20; i++) {
      expect(economiaMapa2DService.calcularOcupacao(85, recomendado, "mediana", 3.0)).toBe(true);
    }
    // razao=2.0 >= 1+sens(comum=0.15) → prob mínima (5%). Em 300 tentativas,
    // a taxa de ocupação deve ficar bem abaixo do preço-justo (limiar folgado
    // pra evitar flakiness — não é um teste de exatidão estatística).
    let ocupacoes = 0;
    const tentativas = 300;
    for (let i = 0; i < tentativas; i++) {
      if (economiaMapa2DService.calcularOcupacao(200, recomendado, "comum", 3.0)) ocupacoes++;
    }
    expect(ocupacoes / tentativas).toBeLessThan(0.15);
  });

  it("reputação alta afunda a sensibilidade — ocupa mais fácil acima do recomendado que reputação baixa", () => {
    const recomendado = 100;
    const pedido = 130; // razao 1.3

    let ocupacoesAlta = 0;
    let ocupacoesBaixa = 0;
    const tentativas = 400;
    for (let i = 0; i < tentativas; i++) {
      if (economiaMapa2DService.calcularOcupacao(pedido, recomendado, "mediana", 5.0)) ocupacoesAlta++;
      if (economiaMapa2DService.calcularOcupacao(pedido, recomendado, "mediana", 0.0)) ocupacoesBaixa++;
    }
    expect(ocupacoesAlta / tentativas).toBeGreaterThan(ocupacoesBaixa / tentativas);
  });
});

describe("construcao.service (mapa2d) — Fatia 2: upgrade de nível", () => {
  async function criarTerrenoUpgrade(codigo: string) {
    return prisma.terreno.upsert({
      where: { codigo },
      update: {},
      create: { codigo, regiaoNome: "Mascherano", categoria: "mediana", multiplicador: 1.3, slots: 1, precoBase: 390 },
    });
  }

  it("subirNivel cobra custoBase × 1.8^nivelAtual e incrementa o nível", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerrenoUpgrade("mediana-upgrade-01");
    const st = await criarSessionTerrenoComDono(sessao.id, terreno.id, player.id);
    await construcaoMapa2DService.construir(sessao.id, player.id, st.id, "casa");
    const construcao = await prisma.construcao.findUnique({ where: { sessionTerrenoId: st.id } });

    const result = await construcaoMapa2DService.subirNivel(sessao.id, player.id, construcao!.id);
    // custoBase = 1 slot × 120 = 120; upgrade do nível 1 → 2 = round(120 × 1.8^1) = 216
    expect(result.custo).toBe(216);
    expect(result.novoNivel).toBe(2);

    const construcaoFinal = await prisma.construcao.findUnique({ where: { id: construcao!.id } });
    expect(construcaoFinal?.nivel).toBe(2);
  });

  it("recusa subir acima do nível máximo do tipo", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 100000 });
    const terreno = await criarTerrenoUpgrade("mediana-upgrade-02");
    const st = await criarSessionTerrenoComDono(sessao.id, terreno.id, player.id);
    await construcaoMapa2DService.construir(sessao.id, player.id, st.id, "casa");
    const construcao = await prisma.construcao.findUnique({ where: { sessionTerrenoId: st.id } });

    // casa: NIVEL_MAX = 3 — sobe de 1 até 3 (2 upgrades), o 3º deve falhar
    await construcaoMapa2DService.subirNivel(sessao.id, player.id, construcao!.id);
    await construcaoMapa2DService.subirNivel(sessao.id, player.id, construcao!.id);

    await expect(construcaoMapa2DService.subirNivel(sessao.id, player.id, construcao!.id)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("CONCORRÊNCIA REAL: dois upgrades simultâneos na mesma construção — só 1 sucede (updateMany WHERE nivel: atual)", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 10000 });
    const terreno = await criarTerrenoUpgrade("mediana-upgrade-03");
    const st = await criarSessionTerrenoComDono(sessao.id, terreno.id, player.id);
    await construcaoMapa2DService.construir(sessao.id, player.id, st.id, "casa");
    const construcao = await prisma.construcao.findUnique({ where: { sessionTerrenoId: st.id } });

    const results = await Promise.allSettled([
      construcaoMapa2DService.subirNivel(sessao.id, player.id, construcao!.id),
      construcaoMapa2DService.subirNivel(sessao.id, player.id, construcao!.id),
    ]);

    const { sucesso, falha } = contarResultados(results);
    expect(sucesso).toBe(1);
    expect(falha).toBe(1);

    const construcaoFinal = await prisma.construcao.findUnique({ where: { id: construcao!.id } });
    expect(construcaoFinal?.nivel).toBe(2); // exatamente 1 upgrade aplicado, não 2
  });
});
