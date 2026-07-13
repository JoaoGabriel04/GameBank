import { jest } from "@jest/globals";

// Mesmo padrão de banco.test.ts/turno.test.ts: sem socket real nos testes.
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

const { prisma } = await import("../../lib/prisma.js");
const { criarUsuario, criarSessao, criarPlayer } = await import("../helpers/factories.js");
const { BancoService } = await import("../../modules/banco/banco.service.js");
const { DividaService } = await import("../../modules/divida/divida.service.js");
const { CartaService } = await import("../../modules/carta/carta.service.js");
const { ShopService } = await import("../../modules/shop/shop.service.js");

const bancoService = new BancoService();
const dividaService = new DividaService();
const cartaService = new CartaService();
const shopService = new ShopService();

// Conta, entre os dois resultados de um Promise.allSettled, quantos
// cumpriram e quantos rejeitaram — as duas corridas devem sempre resultar
// em exatamente 1 sucesso + 1 rejeição (nunca os dois sucessos).
function contarResultados(results: PromiseSettledResult<any>[]) {
  const sucesso = results.filter((r) => r.status === "fulfilled").length;
  const falha = results.filter((r) => r.status === "rejected").length;
  return { sucesso, falha };
}

describe("FIX_RACE_CONDITION_SALDO — Etapa 6 (teste de corrida)", () => {
  it("duas transferências simultâneas do mesmo valor não deixam saldo negativo", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const pagador = await criarPlayer(sessao.id, owner.id, { saldo: 100 });
    const recebedor = await criarPlayer(sessao.id, null, { saldo: 0, nome: "P2", cor: "Vermelho" });

    const results = await Promise.allSettled([
      bancoService.transferencia(pagador.id, recebedor.id, sessao.id, 100),
      bancoService.transferencia(pagador.id, recebedor.id, sessao.id, 100),
    ]);

    const { sucesso, falha } = contarResultados(results);
    expect(sucesso).toBe(1);
    expect(falha).toBe(1);

    const pagadorFinal = await prisma.sessionPlayer.findUnique({ where: { id: pagador.id } });
    const recebedorFinal = await prisma.sessionPlayer.findUnique({ where: { id: recebedor.id } });
    expect(pagadorFinal?.saldo).toBe(0); // nunca negativo
    expect(recebedorFinal?.saldo).toBe(100); // só recebeu uma vez
  });

  it("dois saques simultâneos do mesmo valor não deixam saldo negativo", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 100 });

    const results = await Promise.allSettled([
      bancoService.saque(player.id, sessao.id, 100),
      bancoService.saque(player.id, sessao.id, 100),
    ]);

    const { sucesso, falha } = contarResultados(results);
    expect(sucesso).toBe(1);
    expect(falha).toBe(1);

    const final = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(final?.saldo).toBe(0);
  });

  it("duas tentativas simultâneas de pagar a mesma dívida: só uma quita", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 500 });
    const debt = await prisma.debt.create({
      data: { sessionId: sessao.id, playerId: player.id, valor: 500, descricao: "Dívida de teste" },
    });

    const results = await Promise.allSettled([
      dividaService.pagarDivida(debt.id, player.id),
      dividaService.pagarDivida(debt.id, player.id),
    ]);

    const { sucesso, falha } = contarResultados(results);
    expect(sucesso).toBe(1);
    expect(falha).toBe(1);

    const final = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(final?.saldo).toBe(0); // pagou uma vez só, nunca fica negativo

    const debtFinal = await prisma.debt.findUnique({ where: { id: debt.id } });
    expect(debtFinal?.pago).toBe(true);
  });

  it("usar a mesma carta 'Saia da Prisão' duas vezes simultaneamente: só a primeira consome", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const player = await criarPlayer(sessao.id, owner.id, { saldo: 1000 });
    await prisma.sessionPlayer.update({ where: { id: player.id }, data: { carta_prisao: true } });

    const results = await Promise.allSettled([
      cartaService.usarCartaPrisao(sessao.id, player.id),
      cartaService.usarCartaPrisao(sessao.id, player.id),
    ]);

    const { sucesso, falha } = contarResultados(results);
    expect(sucesso).toBe(1);
    expect(falha).toBe(1);

    const final = await prisma.sessionPlayer.findUnique({ where: { id: player.id } });
    expect(final?.carta_prisao).toBe(false);
  });

  it("duas compras simultâneas do mesmo item na loja: só uma é aplicada", async () => {
    const user = await criarUsuario({ coins: 100 });
    const shopItem = await prisma.shopItem.create({
      data: { name: "Item de teste", price: 100, type: "badge", available: true },
    });

    const results = await Promise.allSettled([
      shopService.buyItem(user.id, shopItem.id),
      shopService.buyItem(user.id, shopItem.id),
    ]);

    const { sucesso, falha } = contarResultados(results);
    expect(sucesso).toBe(1);
    expect(falha).toBe(1);

    const final = await prisma.user.findUnique({ where: { id: user.id } });
    expect(final?.coins).toBe(0); // pagou uma vez só
    const items = JSON.parse(JSON.stringify(final?.user_items ?? []));
    const compras = items.filter((r: any) => r.item_id === shopItem.id);
    expect(compras.length).toBe(1); // item não duplicado no inventário
  });
});
