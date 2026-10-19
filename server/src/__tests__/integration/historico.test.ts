import { jest } from "@jest/globals";

jest.unstable_mockModule("../../lib/socket.js", () => ({
  getIO: jest.fn(),
  initSocket: jest.fn(),
  emitToRoom: jest.fn(),
  emitToUser: jest.fn(async () => true),
  emitToUserWithRetry: jest.fn(async () => true),
  emitToPlayer: jest.fn(),
  emitChatMessage: jest.fn(),
}));

const { prisma } = await import("../../lib/prisma.js");
const { criarUsuario, criarSessao, criarPlayer } = await import("../helpers/factories.js");
const { SessionService } = await import("../../modules/session/session.service.js");
const { HistoricoService } = await import("../../modules/historico/historico.service.js");
const { HISTORICO_NO_PAYLOAD } = await import("../../modules/session/session.repository.js");

async function sessaoComHistorico(linhas: number) {
  const owner = await criarUsuario();
  const sessao = await criarSessao(owner.id);
  await criarPlayer(sessao.id, owner.id, { nome: "P1" });
  await prisma.historico.createMany({
    data: Array.from({ length: linhas }, (_, i) => ({
      sessionId: sessao.id, data: new Date(), tipo: "TESTE", detalhes: `linha ${i + 1}`,
    })),
  });
  return sessao;
}

describe("Histórico no payload da sessão", () => {
  it(`leva só as últimas ${HISTORICO_NO_PAYLOAD} entradas, em ordem crescente`, async () => {
    const sessao = await sessaoComHistorico(HISTORICO_NO_PAYLOAD + 45);
    const svc = new SessionService();
    await svc.invalidateCache(sessao.id);

    const payload = await svc.loadSession(sessao.id);

    expect(payload.historico).toHaveLength(HISTORICO_NO_PAYLOAD);
    const ids = payload.historico.map((h: { id: number }) => h.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(payload.historico.at(-1).detalhes).toBe(`linha ${HISTORICO_NO_PAYLOAD + 45}`);
  });
});

describe("Histórico completo paginado", () => {
  it("pagina do mais recente para o mais antigo até acabar", async () => {
    const sessao = await sessaoComHistorico(75);
    const svc = new HistoricoService();

    const p1 = await svc.listarPagina(sessao.id, 50);
    expect(p1.itens).toHaveLength(50);
    expect(p1.itens[0].detalhes).toBe("linha 75");
    expect(p1.proximoCursor).toBe(p1.itens[49].id);

    const p2 = await svc.listarPagina(sessao.id, 50, p1.proximoCursor!);
    expect(p2.itens).toHaveLength(25);
    expect(p2.itens.at(-1)!.detalhes).toBe("linha 1");
    expect(p2.proximoCursor).toBeNull();
  });
});
