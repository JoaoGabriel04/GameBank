import { jest } from "@jest/globals";

const emitidos: { evento: string; payload: any }[] = [];
jest.unstable_mockModule("../../lib/socket.js", () => ({
  getIO: () => ({
    of: () => ({ to: () => ({ emit: (evento: string, payload: unknown) => emitidos.push({ evento, payload }) }) }),
  }),
}));

const { emitSessionUpdated } = await import("../../modules/socket/socket.handler.js");

describe("emitSessionUpdated — broadcast sem catálogo estático", () => {
  it("tira tabuleiro e sessionPosses[].propriedade sem mutar o objeto original", () => {
    const sessao = {
      id: 1,
      ultimoDado1: null,
      ultimoDado2: null,
      aguardandoEscolha: true,
      tabuleiro: [{ pos: 0, nome: "Início", tipo: "inicio" }],
      sessionPosses: [{ id: 10, propId: 1, playerId: 5, casas: 2, propriedade: { id: 1, nome: "Av. 9 de Julho" } }],
    };

    emitSessionUpdated(1, sessao);

    const { evento, payload } = emitidos.at(-1)!;
    expect(evento).toBe("session:updated");
    expect(payload).not.toHaveProperty("tabuleiro");
    expect(payload.sessionPosses).toEqual([{ id: 10, propId: 1, playerId: 5, casas: 2 }]);
    // O mascaramento dos dados às cegas continua como veio.
    expect(payload.ultimoDado1).toBeNull();
    // O mesmo objeto também vira resposta REST: não pode ter sido alterado.
    expect(sessao.tabuleiro).toHaveLength(1);
    expect(sessao.sessionPosses[0].propriedade).toEqual({ id: 1, nome: "Av. 9 de Julho" });
  });

  it("aceita payloads sem esses campos", () => {
    emitSessionUpdated(2, { id: 2, status: "Esperando" });
    expect(emitidos.at(-1)!.payload).toEqual({ id: 2, status: "Esperando" });
  });
});
