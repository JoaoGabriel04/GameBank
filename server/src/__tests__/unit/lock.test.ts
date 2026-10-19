import { randomUUID } from "node:crypto";

const { withLock } = await import("../../middleware/lock.middleware.js");
const { connectRedis, getRedis } = await import("../../lib/redis.js");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mesmos cenários com e sem Redis: o fallback em memória precisa ter o mesmo
// contrato (antes, sem Redis, withLock rodava a ação sem lock nenhum).
function cenarios() {
  const chave = () => `teste:${randomUUID()}`;

  it("duplo clique: a segunda chamada espera a primeira em vez de receber 423", async () => {
    const k = chave();
    const ordem: string[] = [];
    const acao = (nome: string) => async () => {
      ordem.push(`${nome}:inicio`);
      await sleep(150);
      ordem.push(`${nome}:fim`);
      return nome;
    };

    const resultados = await Promise.all([withLock(k, acao("a")), withLock(k, acao("b"))]);

    expect(resultados.sort()).toEqual(["a", "b"]);
    // Serializado: nenhuma começa antes de a outra terminar.
    expect(ordem[1]).toMatch(/:fim$/);
    expect(ordem[2]).toMatch(/:inicio$/);
  });

  it("devolve 423 só depois de esperar o limite (~1,5s)", async () => {
    const k = chave();
    const longa = withLock(k, () => sleep(2500));
    await sleep(20);

    const inicio = Date.now();
    await expect(withLock(k, async () => "nunca")).rejects.toMatchObject({ statusCode: 423 });
    const esperou = Date.now() - inicio;
    expect(esperou).toBeGreaterThanOrEqual(1000);
    expect(esperou).toBeLessThan(2400);

    await longa;
  });

  it("quem passou do TTL não libera o lock de quem pegou depois", async () => {
    const k = chave();
    const ordem: string[] = [];

    // A segura o lock além do TTL (100ms); B pega depois que expira.
    const a = withLock(k, async () => { await sleep(300); ordem.push("a:fim"); }, { ttlMs: 100 });
    await sleep(20);
    const b = withLock(k, async () => { ordem.push("b:inicio"); await sleep(400); ordem.push("b:fim"); });
    await sleep(320); // A já terminou e "liberou" — não pode ter apagado o lock de B.
    const c = withLock(k, async () => { ordem.push("c:inicio"); });

    await Promise.all([a, b, c]);
    expect(ordem.indexOf("c:inicio")).toBeGreaterThan(ordem.indexOf("b:fim"));
  });

  it("libera o lock quando a ação lança erro", async () => {
    const k = chave();
    await expect(withLock(k, async () => { throw new Error("falhou"); })).rejects.toThrow("falhou");

    const inicio = Date.now();
    await withLock(k, async () => {});
    expect(Date.now() - inicio).toBeLessThan(100);
  });
}

describe("withLock — sem Redis (lock em memória)", () => {
  beforeAll(() => {
    expect(getRedis()).toBeNull();
  });
  cenarios();
});

describe("withLock — com Redis", () => {
  beforeAll(async () => {
    await connectRedis();
  });
  afterAll(async () => {
    await getRedis()?.quit();
  });
  cenarios();
});
