const { prisma } = await import("../../lib/prisma.js");
const { criarUsuario, criarSessao, criarPlayer } = await import("../helpers/factories.js");
const { shopRepository, invalidarCatalogoCosmeticos } = await import("../../modules/shop/shop.repository.js");
const { mapSessionPlayers } = await import("../../utils/session-mapper.js");

async function itemDeTeste(type: "banner" | "badge" | "title", value: string) {
  return prisma.shopItem.create({ data: { name: `Teste ${type} ${Date.now()}`, price: 1, type, value } });
}

async function usuarioCom(itens: { item_id: number; equipped: boolean }[]) {
  const u = await criarUsuario();
  return prisma.user.update({
    where: { id: u.id },
    data: { user_items: itens.map((i) => ({ ...i, acquiredAt: new Date().toISOString() })) },
  });
}

describe("Cosméticos em lote + cache do catálogo", () => {
  beforeEach(() => invalidarCatalogoCosmeticos());

  it("resolveUserItemsEmLote dá o mesmo resultado que resolveUserItems por usuário", async () => {
    const badge = await itemDeTeste("badge", JSON.stringify({ badge: "estrela" }));
    const titulo = await itemDeTeste("title", JSON.stringify({ title: "Magnata" }));
    const a = await usuarioCom([{ item_id: badge.id, equipped: true }, { item_id: titulo.id, equipped: false }]);
    const b = await usuarioCom([{ item_id: titulo.id, equipped: true }]);
    const c = await usuarioCom([]);

    const lote = await shopRepository.resolveUserItemsEmLote([a, b, c]);

    for (const u of [a, b, c]) {
      expect(lote.get(u.id)).toEqual(await shopRepository.resolveUserItems(u.id));
    }
    expect(lote.get(c.id)).toEqual([]);
  });

  it("mapSessionPlayers resolve badge e título equipados (com e sem user_items na query)", async () => {
    const badge = await itemDeTeste("badge", JSON.stringify({ badge: "coroa" }));
    const titulo = await itemDeTeste("title", JSON.stringify({ title: "Banqueiro" }));
    const u = await usuarioCom([{ item_id: badge.id, equipped: true }, { item_id: titulo.id, equipped: true }]);
    const sessao = await criarSessao(u.id);
    await criarPlayer(sessao.id, u.id, { nome: "Dono" });
    await criarPlayer(sessao.id, null, { nome: "Sem conta", cor: "Vermelho" });

    for (const comItens of [true, false]) {
      const players = await prisma.sessionPlayer.findMany({
        where: { sessionId: sessao.id },
        include: { user: { select: { id: true, avatarUrl: true, avatarUpdatedAt: true, ...(comItens ? { user_items: true } : {}) } } },
        orderBy: { id: "asc" },
      });
      const [dono, semConta] = await mapSessionPlayers(players);
      expect(dono.badge).toBe("coroa");
      expect(dono.title).toBe("Banqueiro");
      expect(semConta.badge).toBeNull();
    }
  });

  it("usa o cache do catálogo até ser invalidado", async () => {
    const titulo = await itemDeTeste("title", JSON.stringify({ title: "Antigo" }));
    const u = await usuarioCom([{ item_id: titulo.id, equipped: true }]);

    expect((await shopRepository.resolveUserItems(u.id))[0].value).toContain("Antigo");
    await prisma.shopItem.update({ where: { id: titulo.id }, data: { value: JSON.stringify({ title: "Novo" }) } });

    // Ainda em cache (TTL de 60s)...
    expect((await shopRepository.resolveUserItems(u.id))[0].value).toContain("Antigo");
    // ...até o admin invalidar.
    invalidarCatalogoCosmeticos();
    expect((await shopRepository.resolveUserItems(u.id))[0].value).toContain("Novo");
  });

  it("equipar (mudar user_items) aparece na hora, sem depender do cache", async () => {
    const t1 = await itemDeTeste("title", JSON.stringify({ title: "Um" }));
    const t2 = await itemDeTeste("title", JSON.stringify({ title: "Dois" }));
    const u = await usuarioCom([{ item_id: t1.id, equipped: true }, { item_id: t2.id, equipped: false }]);
    await shopRepository.resolveUserItems(u.id);

    await prisma.user.update({
      where: { id: u.id },
      data: { user_items: [{ item_id: t1.id, equipped: false, acquiredAt: "" }, { item_id: t2.id, equipped: true, acquiredAt: "" }] },
    });

    const equipado = (await shopRepository.resolveUserItems(u.id)).find((i) => i.equipped);
    expect(equipado?.id).toBe(t2.id);
  });
});
