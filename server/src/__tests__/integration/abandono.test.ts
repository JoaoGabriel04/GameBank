import { jest } from "@jest/globals";

// Presença simulada: cada sala responde ao fetchSockets com a próxima
// resposta da fila dela (ou a última, se a fila acabou). Uma resposta
// "erro" simula o adapter do Redis indisponível.
type SocketFalso = { data: { playerId?: number; userId?: number } };
const presenca = new Map<string, (SocketFalso[] | "erro")[]>();
function responder(sessionId: number, ...respostas: (SocketFalso[] | "erro")[]) {
  presenca.set(`session:${sessionId}`, respostas);
}
const fakeIO = {
  of: () => ({
    in: (sala: string) => ({
      fetchSockets: async () => {
        const fila = presenca.get(sala) ?? [[]];
        const r = fila.length > 1 ? fila.shift()! : fila[0];
        if (r === "erro") throw new Error("timeout reached while waiting for fetchSockets response");
        return r;
      },
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
const emitSessionClosed = jest.fn();
jest.unstable_mockModule("../../modules/socket/socket.handler.js", () => ({
  emitSessionUpdated: jest.fn(),
  emitSessionClosed,
  emitChatMessage: jest.fn(),
  emitNotificationNew: jest.fn(),
  emitUpdatedSession: jest.fn(async () => {}),
  emitTurnoTimeout: jest.fn(),
}));
const recompensasAdd = jest.fn(async () => ({}));
const missoesAdd = jest.fn(async () => ({}));
jest.unstable_mockModule("../../lib/queues.js", () => ({
  bullMQConnection: {},
  recompensasQueue: { add: recompensasAdd },
  missoesQueue: { add: missoesAdd },
  cacheQueue: { add: jest.fn(async () => ({})) },
  initQueueMonitoring: jest.fn(),
}));

const { prisma } = await import("../../lib/prisma.js");
const { criarUsuario, criarSessao, criarPlayer } = await import("../helpers/factories.js");
const { abandonoService } = await import("../../modules/session/abandono.service.js");
const { SALA_ABANDONADA_MS } = await import("../../constants/sessao.js");

const MIN = 60_000;
// Relógio sempre crescente entre os testes: o serviço é um singleton e só
// varre de novo depois de 1 min.
let relogio = Date.now();
function avancar(ms: number) {
  relogio += ms;
  return relogio;
}

beforeEach(() => {
  presenca.clear();
  abandonoService.vaziaDesde.clear();
  emitSessionClosed.mockClear();
  recompensasAdd.mockClear();
  missoesAdd.mockClear();
  avancar(10 * MIN);
});

// Partida em andamento, há 2 h (passaria do mínimo de duração do antifarm),
// com compras feitas (atividade) e um usuário por jogador.
async function partida(tipoJogo: "tabuleiro" | "banca" | "mapa2d" = "tabuleiro") {
  const u1 = await criarUsuario({ coins: 1000 });
  const u2 = await criarUsuario({ coins: 1000 });
  const sessao = await criarSessao(u1.id, { startedAt: new Date(Date.now() - 2 * 60 * MIN) });
  await prisma.session.update({ where: { id: sessao.id }, data: { tipoJogo, rodadaAtual: 40 } });
  const p1 = await criarPlayer(sessao.id, u1.id, { nome: "P1" });
  const p2 = await criarPlayer(sessao.id, u2.id, { nome: "P2", cor: "Vermelho" });
  return { sessionId: sessao.id, ownerId: u1.id, u1, u2, p1, p2 };
}

async function existe(sessionId: number) {
  return (await prisma.session.findUnique({ where: { id: sessionId } })) !== null;
}

describe("Salas abandonadas", () => {
  it("vazia por 15 min: encerra sem recompensa, troféu, missão nem baú", async () => {
    const { sessionId, u1, u2 } = await partida();
    responder(sessionId, []);

    await abandonoService.varrerSalasAbandonadas(avancar(MIN));      // começa a contar
    await abandonoService.varrerSalasAbandonadas(avancar(14 * MIN)); // 14 min vazia
    expect(await existe(sessionId)).toBe(true);

    await abandonoService.varrerSalasAbandonadas(avancar(MIN));      // 15 min vazia
    expect(await existe(sessionId)).toBe(false);

    expect(await prisma.gameResult.count({ where: { sessionId } })).toBe(0);
    for (const u of [u1, u2]) {
      const depois = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(depois).toMatchObject({ coins: u.coins, xp: u.xp, trophies: u.trophies, totalGames: u.totalGames });
    }
    expect(recompensasAdd).not.toHaveBeenCalled();
    expect(missoesAdd).not.toHaveBeenCalled();
    expect(emitSessionClosed).toHaveBeenCalledWith(sessionId);
  });

  it("jogador conectado mantém a sala; a contagem recomeça quando ele sai", async () => {
    const { sessionId, p1 } = await partida();
    responder(sessionId, []);
    await abandonoService.varrerSalasAbandonadas(avancar(MIN));
    await abandonoService.varrerSalasAbandonadas(avancar(10 * MIN));

    responder(sessionId, [{ data: { playerId: p1.id } }]);
    await abandonoService.varrerSalasAbandonadas(avancar(MIN));

    responder(sessionId, []);
    await abandonoService.varrerSalasAbandonadas(avancar(MIN));      // volta a contar daqui
    await abandonoService.varrerSalasAbandonadas(avancar(14 * MIN));
    expect(await existe(sessionId)).toBe(true);
    await abandonoService.varrerSalasAbandonadas(avancar(MIN));
    expect(await existe(sessionId)).toBe(false);
  });

  it("Modo Banca: o dono conectado (banqueiro) mantém a sala", async () => {
    const { sessionId, ownerId } = await partida("banca");
    responder(sessionId, [{ data: { userId: ownerId } }]);

    await abandonoService.varrerSalasAbandonadas(avancar(MIN));
    await abandonoService.varrerSalasAbandonadas(avancar(SALA_ABANDONADA_MS + MIN));

    expect(await existe(sessionId)).toBe(true);
  });

  it("espectador e jogador que já saiu não contam como conectados", async () => {
    const { sessionId, p2 } = await partida();
    await prisma.sessionPlayer.update({ where: { id: p2.id }, data: { desistiu: true, desistiuEm: new Date() } });
    const espectador = await criarUsuario();
    responder(sessionId, [{ data: { userId: espectador.id } }, { data: { playerId: p2.id } }]);

    await abandonoService.varrerSalasAbandonadas(avancar(MIN));
    await abandonoService.varrerSalasAbandonadas(avancar(SALA_ABANDONADA_MS));

    expect(await existe(sessionId)).toBe(false);
  });

  it("jogador que reconecta entre a varredura e o lock mantém a sala", async () => {
    const { sessionId, p1 } = await partida();
    // Vazia nas duas varreduras; na reconferência dentro do lock, P1 voltou.
    responder(sessionId, [], [], [{ data: { playerId: p1.id } }]);

    await abandonoService.varrerSalasAbandonadas(avancar(MIN));
    await abandonoService.varrerSalasAbandonadas(avancar(SALA_ABANDONADA_MS));

    expect(await existe(sessionId)).toBe(true);
    expect(emitSessionClosed).not.toHaveBeenCalled();
  });

  it("presença indisponível não conta como sala vazia", async () => {
    const { sessionId } = await partida();
    responder(sessionId, "erro");

    await abandonoService.varrerSalasAbandonadas(avancar(MIN));
    await abandonoService.varrerSalasAbandonadas(avancar(SALA_ABANDONADA_MS + MIN));

    expect(await existe(sessionId)).toBe(true);
    expect(abandonoService.vaziaDesde.has(sessionId)).toBe(false);
  });

  it("Mapa 2D fica de fora", async () => {
    const { sessionId } = await partida("mapa2d");
    responder(sessionId, []);

    await abandonoService.varrerSalasAbandonadas(avancar(MIN));
    await abandonoService.varrerSalasAbandonadas(avancar(SALA_ABANDONADA_MS + MIN));

    expect(await existe(sessionId)).toBe(true);
  });

  it("sala em espera não é tocada", async () => {
    const { sessionId } = await partida();
    await prisma.session.update({ where: { id: sessionId }, data: { status: "Esperando" } });
    responder(sessionId, []);

    await abandonoService.varrerSalasAbandonadas(avancar(MIN));
    await abandonoService.varrerSalasAbandonadas(avancar(SALA_ABANDONADA_MS + MIN));

    expect(await existe(sessionId)).toBe(true);
  });
});
