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
const { emprestimoMapa2DService } = await import("../services/emprestimo.service.js");

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

async function criarSessaoMapa2D(
  ownerId: number,
  overrides: Partial<{ rodadaAtual: number; eventoAtual: string | null; eventoProximo: string | null; inflacaoAcumuladaMapa2D: number }> = {}
) {
  return prisma.session.create({
    data: {
      ownerId,
      status: "Em Andamento",
      tipoJogo: "mapa2d",
      modo: "individual",
      startedAt: new Date(),
      rodadaAtual: overrides.rodadaAtual ?? 1,
      eventoAtual: overrides.eventoAtual,
      eventoProximo: overrides.eventoProximo,
      inflacaoAcumuladaMapa2D: overrides.inflacaoAcumuladaMapa2D ?? 0,
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

describe("fechamento.service (mapa2d) — Fatia 2: eventos econômicos", () => {
  it("evento anunciado (eventoProximo) ativa no mês seguinte e depois some", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id, { rodadaAtual: 3, eventoProximo: "RECESSAO" });
    await criarPlayer(sessao.id, owner.id, { saldo: 1000 });

    await fechamentoMapa2DService.fecharMes(sessao.id);
    let atual = await prisma.session.findUnique({ where: { id: sessao.id } });
    expect(atual?.eventoAtual).toBe("RECESSAO");
    expect(atual?.eventoProximo).toBeNull(); // novoMes=4 → (5)%2=1 → sem novo anúncio

    await fechamentoMapa2DService.fecharMes(sessao.id);
    atual = await prisma.session.findUnique({ where: { id: sessao.id } });
    expect(atual?.eventoAtual).toBeNull(); // evento durou só 1 mês
  });

  it("inflacaoAcumuladaMapa2D é cumulativa entre meses (não reseta)", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id, { rodadaAtual: 1, eventoProximo: "INFLACAO_ALTA" });
    await criarPlayer(sessao.id, owner.id, { saldo: 1000 });

    await fechamentoMapa2DService.fecharMes(sessao.id);
    let atual = await prisma.session.findUnique({ where: { id: sessao.id } });
    expect(atual?.eventoAtual).toBe("INFLACAO_ALTA");
    expect(atual?.inflacaoAcumuladaMapa2D).toBeCloseTo(0.08);

    // Força uma segunda ativação determinística do mesmo evento, pra provar acumulação.
    await prisma.session.update({ where: { id: sessao.id }, data: { eventoProximo: "INFLACAO_ALTA" } });
    await fechamentoMapa2DService.fecharMes(sessao.id);
    atual = await prisma.session.findUnique({ where: { id: sessao.id } });
    expect(atual?.inflacaoAcumuladaMapa2D).toBeCloseTo(0.16);
  });

  it("mercadoMult do evento ativo eleva o aluguel recomendado usado na avaliação de ocupação", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id, { eventoAtual: "BOOM_IMOBILIARIO" });
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerreno({ codigo: "mediana-boom-01", categoria: "mediana", multiplicador: 1.3, precoBase: 390 });
    const st = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 390, adquiridoEm: new Date() },
    });
    // recomendado sem boom = round(50×1.3) = 65; com boom (mercadoMult 1.35) = round(65×1.35) = 88.
    // Pedido de 80 fica ACIMA do recomendado sem boom (ficaria vago), mas ABAIXO com boom (ocupa garantido, razão ≤ 0.9).
    await prisma.construcao.create({ data: { sessionTerrenoId: st.id, tipo: "casa", nivel: 1, aluguelPedido: 79 } });

    await fechamentoMapa2DService.fecharMes(sessao.id);

    const construcaoFinal = await prisma.construcao.findUnique({ where: { sessionTerrenoId: st.id } });
    expect(construcaoFinal?.ocupado).toBe(true);
  });

  it("jurosMult do evento ativo afeta os juros do empréstimo no fechamento", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id, { eventoAtual: "ALTA_JUROS" });
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 5000 });
    const terreno = await criarTerreno({ codigo: "mediana-juros-01", categoria: "mediana", multiplicador: 1.3, precoBase: 390 });
    const st = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 390, adquiridoEm: new Date() },
    });
    await prisma.construcao.create({ data: { sessionTerrenoId: st.id, tipo: "casa", nivel: 1, aluguelPedido: 50 } });
    const emprestimo = await prisma.emprestimoMapa.create({
      data: { sessionId: sessao.id, playerId: player.id, valorOriginal: 1000, valorDevido: 1000, garantiaSessionTerrenoId: st.id },
    });

    await fechamentoMapa2DService.fecharMes(sessao.id);

    const emprestimoFinal = await prisma.emprestimoMapa.findUnique({ where: { id: emprestimo.id } });
    // juros = 10% × jurosMult(2.0) = 20% → 1000 × 1.2 = 1200
    expect(emprestimoFinal?.valorDevido).toBe(1200);
  });
});

describe("fechamento.service (mapa2d) — Fatia 2: ORDEM CRÍTICA da garantia do empréstimo na falência", () => {
  it("marcarEmprestimoExecutado roda ANTES de liberarTerrenosDoJogador na falência", async () => {
    const { mapa2dRepository } = await import("../mapa2d.repository.js");
    const chamadas: string[] = [];

    const spyExecutado = jest
      .spyOn(mapa2dRepository, "marcarEmprestimoExecutado")
      .mockImplementation(async (id: number) => {
        chamadas.push("marcarEmprestimoExecutado");
        return prisma.emprestimoMapa.update({ where: { id }, data: { executado: true } });
      });
    const spyLiberar = jest
      .spyOn(mapa2dRepository, "liberarTerrenosDoJogador")
      .mockImplementation(async (sessionId: number, playerId: number) => {
        chamadas.push("liberarTerrenosDoJogador");
        return prisma.sessionTerreno.updateMany({
          where: { sessionId, donoId: playerId },
          data: { donoId: null, precoPago: null, adquiridoEm: null },
        });
      });

    try {
      const owner = await criarUsuario();
      const sessao = await criarSessaoMapa2D(owner.id);
      const player = await criarPlayer(sessao.id, owner.id, { saldo: 0 });
      const terreno = await criarTerreno({ codigo: "alphaville-emp-01", categoria: "rica", multiplicador: 3.5, precoBase: 3000 });
      const st = await prisma.sessionTerreno.create({
        data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 3000, adquiridoEm: new Date() },
      });
      const emprestimo = await prisma.emprestimoMapa.create({
        data: { sessionId: sessao.id, playerId: player.id, valorOriginal: 500, valorDevido: 500, garantiaSessionTerrenoId: st.id },
      });

      // 2 meses de graça + o 3º mês devendo dispara a falência.
      await fechamentoMapa2DService.fecharMes(sessao.id);
      await fechamentoMapa2DService.fecharMes(sessao.id);
      await fechamentoMapa2DService.fecharMes(sessao.id);

      expect(chamadas).toEqual(["marcarEmprestimoExecutado", "liberarTerrenosDoJogador"]);

      const emprestimoFinal = await prisma.emprestimoMapa.findUnique({ where: { id: emprestimo.id } });
      expect(emprestimoFinal?.executado).toBe(true);

      const stFinal = await prisma.sessionTerreno.findUnique({ where: { id: st.id } });
      expect(stFinal?.donoId).toBeNull();

      const historico = await prisma.historico.findFirst({ where: { sessionId: sessao.id, tipo: "MAPA2D_GARANTIA_EXECUTADA" } });
      expect(historico).not.toBeNull();
    } finally {
      spyExecutado.mockRestore();
      spyLiberar.mockRestore();
    }
  });
});

describe("fechamento.service (mapa2d) — Fatia 2: Reputação", () => {
  it("começa em 3.0 (default do schema)", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    expect(player.reputacao).toBe(3.0);
  });

  it("sobe com preço justo sustentado", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerreno({ codigo: "mediana-rep-justo-01", categoria: "mediana", multiplicador: 1.3, precoBase: 390 });
    const st = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 390, adquiridoEm: new Date() },
    });
    // recomendado = round(50×1.3) = 65 — pedido de 50 está dentro do justo.
    await prisma.construcao.create({ data: { sessionTerrenoId: st.id, tipo: "casa", nivel: 1, aluguelPedido: 50 } });

    await fechamentoMapa2DService.fecharMes(sessao.id);

    const playerFinal = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(playerFinal?.reputacao).toBeCloseTo(3.05);
  });

  it("desce com preço abusivo (acima da tolerância da região)", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerreno({ codigo: "mediana-rep-abuso-01", categoria: "mediana", multiplicador: 1.3, precoBase: 390 });
    const st = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 390, adquiridoEm: new Date() },
    });
    // recomendado = 65; sens(mediana) = 0.30 → limiar abusivo = 65×1.3 = 84.5. Pedido de 200 é bem acima.
    await prisma.construcao.create({ data: { sessionTerrenoId: st.id, tipo: "casa", nivel: 1, aluguelPedido: 200 } });

    await fechamentoMapa2DService.fecharMes(sessao.id);

    const playerFinal = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    // -0.10 (abusivo) sempre; -0.05 extra (vacância negligente) na grande maioria dos casos
    // em que o preço tão acima não ocupa — aceita as duas faixas pra não flakear no ~5% que ocupa.
    expect(playerFinal!.reputacao).toBeLessThanOrEqual(2.9);
    expect(playerFinal!.reputacao).toBeGreaterThanOrEqual(2.85);
  });

  it("desce ao entrar em 'Devendo' e cai com penalidade forte na falência (2 meses de graça)", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 0 });
    const terreno = await criarTerreno({ codigo: "alphaville-rep-01", categoria: "rica", multiplicador: 3.5, precoBase: 3000 });
    await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 3000, adquiridoEm: new Date() },
    });

    await fechamentoMapa2DService.fecharMes(sessao.id);
    let atual = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(atual?.reputacao).toBeCloseTo(3.0 - 0.15); // 1º mês devendo

    await fechamentoMapa2DService.fecharMes(sessao.id);
    atual = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(atual?.reputacao).toBeCloseTo(3.0 - 0.15 - 0.15); // 2º mês devendo

    await fechamentoMapa2DService.fecharMes(sessao.id);
    atual = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(atual?.desistiu).toBe(true);
    expect(atual?.reputacao).toBeCloseTo(3.0 - 0.15 - 0.15 - 1.0); // penalidade de falência
  });

  it("nunca sai do intervalo [0.0, 5.0] — clamp no teto", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    await prisma.sessionPlayer.update({ where: { id: player.id }, data: { reputacao: 4.98 } });
    const terreno = await criarTerreno({ codigo: "mediana-rep-clamp-01", categoria: "mediana", multiplicador: 1.3, precoBase: 390 });
    const st = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 390, adquiridoEm: new Date() },
    });
    await prisma.construcao.create({ data: { sessionTerrenoId: st.id, tipo: "casa", nivel: 1, aluguelPedido: 50 } });

    await fechamentoMapa2DService.fecharMes(sessao.id);

    const playerFinal = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(playerFinal!.reputacao).toBeLessThanOrEqual(5.0);
  });

  it("nunca sai do intervalo [0.0, 5.0] — clamp no piso", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    await prisma.sessionPlayer.update({ where: { id: player.id }, data: { reputacao: 0.02 } });
    const terreno = await criarTerreno({ codigo: "mediana-rep-clamp-02", categoria: "mediana", multiplicador: 1.3, precoBase: 390 });
    const st = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 390, adquiridoEm: new Date() },
    });
    await prisma.construcao.create({ data: { sessionTerrenoId: st.id, tipo: "casa", nivel: 1, aluguelPedido: 200 } });

    await fechamentoMapa2DService.fecharMes(sessao.id);

    const playerFinal = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(playerFinal!.reputacao).toBeGreaterThanOrEqual(0.0);
  });
});

describe("emprestimo.service (mapa2d) — limite, garantia e travas", () => {
  it("limite de crédito = 50% do valor livre (terreno + construção, não dado em garantia)", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    const terreno = await criarTerreno({ codigo: "mediana-limite-01", categoria: "mediana", multiplicador: 1.3, precoBase: 390 });
    const st = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terreno.id, donoId: player.id, precoPago: 390, adquiridoEm: new Date() },
    });
    await prisma.construcao.create({ data: { sessionTerrenoId: st.id, tipo: "casa", nivel: 1, aluguelPedido: 50 } });

    // valorLivre = 390 (terreno) + 120 (casa, 1 slot × 120) = 510 → limite = floor(510×0.5) = 255
    await expect(emprestimoMapa2DService.pegarEmprestimo(sessao.id, player.id, 256)).rejects.toMatchObject({ statusCode: 400 });
    const result = await emprestimoMapa2DService.pegarEmprestimo(sessao.id, player.id, 255);
    expect(result.valor).toBe(255);
  });

  it("garantia é a construção que mais rende, e apenas 1 empréstimo ativo por jogador", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessaoMapa2D(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });

    const terrenoA = await criarTerreno({ codigo: "comum-garantia-01", categoria: "comum", multiplicador: 0.6, precoBase: 180 });
    const stA = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terrenoA.id, donoId: player.id, precoPago: 180, adquiridoEm: new Date() },
    });
    await prisma.construcao.create({ data: { sessionTerrenoId: stA.id, tipo: "casa", nivel: 1, aluguelPedido: 0 } });
    // renda casa comum = 50 × 0.6 × 1.0 = 30

    const terrenoB = await criarTerreno({ codigo: "mediana-garantia-01", categoria: "mediana", multiplicador: 1.3, precoBase: 390 });
    const stB = await prisma.sessionTerreno.create({
      data: { sessionId: sessao.id, terrenoId: terrenoB.id, donoId: player.id, precoPago: 390, adquiridoEm: new Date() },
    });
    await prisma.construcao.create({ data: { sessionTerrenoId: stB.id, tipo: "hotel", nivel: 1, aluguelPedido: 0 } });
    // renda hotel mediana = 50 × 1.3 × 3.0 = 195 — maior que a casa

    const result = await emprestimoMapa2DService.pegarEmprestimo(sessao.id, player.id, 100);
    expect(result.garantia.sessionTerrenoId).toBe(stB.id);
    expect(result.garantia.tipo).toBe("hotel");

    await expect(emprestimoMapa2DService.pegarEmprestimo(sessao.id, player.id, 50)).rejects.toMatchObject({ statusCode: 400 });
  });
});
