import { jest } from "@jest/globals";

// Socket e Redis falsos para observar o que chega às partidas abertas: o
// aviso player:updated na sala e a limpeza do cache da sessão no Redis.
const emitidos: { sala: string; evento: string; dados: any }[] = [];
const fakeIO = {
  of: () => ({
    to: (sala: string) => ({
      emit: (evento: string, dados: unknown) => { emitidos.push({ sala, evento, dados }); },
    }),
  }),
};
jest.unstable_mockModule("../../lib/socket.js", () => ({
  getIO: () => fakeIO,
  initSocket: jest.fn(),
  emitToRoom: jest.fn(),
  emitToUser: jest.fn(async () => true),
  emitToUserWithRetry: jest.fn(async () => true),
  emitToPlayer: jest.fn(),
  emitChatMessage: jest.fn(),
}));
const chavesApagadas: string[] = [];
const fakeRedis = {
  del: async (chave: string) => { chavesApagadas.push(chave); return 1; },
};
jest.unstable_mockModule("../../lib/redis.js", () => ({
  getRedis: () => fakeRedis,
  connectRedis: jest.fn(),
}));

const { prisma } = await import("../../lib/prisma.js");
const { criarUsuario, criarSessao, criarPlayer } = await import("../helpers/factories.js");
const { ShopService } = await import("../../modules/shop/shop.service.js");
const { ProfileService } = await import("../../modules/profile/profile.service.js");

const shopService = new ShopService();

async function itemDeTeste(type: "badge" | "title", value: string) {
  return prisma.shopItem.create({ data: { name: `Teste ${type} ${Date.now()}`, price: 100, type, value } });
}

// Usuário com o item no inventário, jogando uma partida em andamento.
async function jogadorEmPartida(itemId: number, equipped: boolean) {
  const u = await criarUsuario();
  await prisma.user.update({
    where: { id: u.id },
    data: { user_items: [{ item_id: itemId, equipped, acquiredAt: new Date().toISOString() }] },
  });
  const sessao = await criarSessao(u.id);
  await criarPlayer(sessao.id, u.id, { nome: "Dono" });
  return { userId: u.id, sessionId: sessao.id };
}

// O perfil invalida em segundo plano (fire-and-forget).
const esperarSegundoPlano = () => new Promise((r) => setTimeout(r, 200));

beforeEach(() => {
  emitidos.length = 0;
  chavesApagadas.length = 0;
});

function avisouSala(sessionId: number, userId: number) {
  return emitidos.some((e) => e.sala === `session:${sessionId}` && e.evento === "player:updated" && e.dados.userId === userId);
}

describe("Cosméticos: partidas abertas veem a mudança", () => {
  it("equipar avisa a sala e limpa o cache da sessão", async () => {
    const badge = await itemDeTeste("badge", JSON.stringify({ badge: "estrela" }));
    const { userId, sessionId } = await jogadorEmPartida(badge.id, false);

    const r = await shopService.equipItem(userId, badge.id);

    expect(r.equipped).toBe(true);
    expect(avisouSala(sessionId, userId)).toBe(true);
    expect(chavesApagadas).toContain(`session:cache:${sessionId}`);
  });

  it("desequipar avisa a sala e limpa o cache da sessão", async () => {
    const titulo = await itemDeTeste("title", JSON.stringify({ title: "Magnata" }));
    const { userId, sessionId } = await jogadorEmPartida(titulo.id, true);

    const r = await shopService.equipItem(userId, titulo.id);

    expect(r.equipped).toBe(false);
    expect(avisouSala(sessionId, userId)).toBe(true);
    expect(chavesApagadas).toContain(`session:cache:${sessionId}`);
  });

  it("vender um item equipado avisa a sala e limpa o cache da sessão", async () => {
    const badge = await itemDeTeste("badge", JSON.stringify({ badge: "coroa" }));
    const { userId, sessionId } = await jogadorEmPartida(badge.id, true);

    await shopService.sellItem(userId, badge.id);

    expect(avisouSala(sessionId, userId)).toBe(true);
    const aviso = emitidos.find((e) => e.evento === "player:updated");
    expect(aviso?.dados.badge).toBeNull();
    expect(chavesApagadas).toContain(`session:cache:${sessionId}`);
  });

  it("vender um item não equipado não avisa ninguém (a aparência não muda)", async () => {
    const badge = await itemDeTeste("badge", JSON.stringify({ badge: "lua" }));
    const { userId, sessionId } = await jogadorEmPartida(badge.id, false);

    await shopService.sellItem(userId, badge.id);

    expect(avisouSala(sessionId, userId)).toBe(false);
    expect(chavesApagadas).not.toContain(`session:cache:${sessionId}`);
  });

  it("mudar o perfil limpa o cache da sessão", async () => {
    const badge = await itemDeTeste("badge", JSON.stringify({ badge: "sol" }));
    const { userId, sessionId } = await jogadorEmPartida(badge.id, false);

    await new ProfileService().updateProfile(userId, { nome: "Novo Apelido" });
    await esperarSegundoPlano();

    expect(chavesApagadas).toContain(`session:cache:${sessionId}`);
  });
});
