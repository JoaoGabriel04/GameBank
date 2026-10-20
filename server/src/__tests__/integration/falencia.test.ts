import { jest } from "@jest/globals";

// Mesmo padrão de turno.test.ts: sem socket real nos testes. As filas do
// BullMQ (baús e missões do fim de partida) também viram no-op.
jest.unstable_mockModule("../../lib/socket.js", () => ({
  getIO: jest.fn(),
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
jest.unstable_mockModule("../../lib/queues.js", () => ({
  bullMQConnection: {},
  recompensasQueue: { add: jest.fn(async () => ({})) },
  missoesQueue: { add: jest.fn(async () => ({})) },
  cacheQueue: { add: jest.fn(async () => ({})) },
  initQueueMonitoring: jest.fn(),
}));

const { prisma } = await import("../../lib/prisma.js");
const { criarUsuario, criarSessao, criarPlayer } = await import("../helpers/factories.js");
const { turnoService } = await import("../../modules/turno/turno.service.js");
const { turnoRepository } = await import("../../modules/turno/turno.repository.js");
const { cancelTurnoTimer } = await import("../../modules/turno/services/timer.service.js");
const { DividaService } = await import("../../modules/divida/divida.service.js");

// Propriedades exclusivas deste teste (ids fixos, grupo próprio).
const GRUPO = "TesteFalencia";
const PROPS = [991001, 991002, 991003];
const PROP_BASE = {
  grupo_cor: GRUPO, tipo: "normal", custo_compra: 2000,
  aluguel_base: 100, aluguel_1c: 200, aluguel_2c: 300, aluguel_3c: 400,
  aluguel_4c: 500, aluguel_hotel: 600, custo_casa: 500, hipoteca: 1000,
};

beforeAll(async () => {
  for (const id of PROPS) {
    await prisma.propriedade.upsert({
      where: { id },
      create: { id, nome: `Terreno Falência ${id}`, ...PROP_BASE },
      update: {},
    });
  }
});

const sessoesAbertas: number[] = [];
afterEach(() => {
  for (const id of sessoesAbertas.splice(0)) cancelTurnoTimer(id);
  emitSessionClosed.mockClear();
});

// Partida de Modo Tabuleiro com `n` jogadores, todos com usuário, na vez do
// primeiro. O primeiro tem uma dívida em aberto.
async function cenario(n: number) {
  const usuarios = [];
  for (let i = 0; i < n; i++) usuarios.push(await criarUsuario());
  const sessao = await criarSessao(usuarios[0].id);
  sessoesAbertas.push(sessao.id);
  await prisma.session.update({ where: { id: sessao.id }, data: { tipoJogo: "tabuleiro", rodadaAtual: 1 } });

  const cores = ["Azul", "Vermelho", "Verde", "Amarelo", "Preto", "Branco"];
  const jogadores = [];
  for (let i = 0; i < n; i++) {
    jogadores.push(await criarPlayer(sessao.id, usuarios[i].id, { nome: `P${i + 1}`, cor: cores[i], saldo: 5000 }));
  }
  await turnoService.iniciarTurnos(sessao.id, jogadores.map(j => j.id));
  // Ordem e vez determinísticas (iniciarTurnos embaralha).
  await prisma.session.update({
    where: { id: sessao.id },
    data: { ordemTurnos: JSON.stringify(jogadores.map(j => j.id)), turnoAtualPlayerId: jogadores[0].id },
  });

  const devedor = jogadores[0];
  await prisma.debt.create({ data: { sessionId: sessao.id, playerId: devedor.id, valor: 9000, descricao: "Aluguel" } });
  return { sessionId: sessao.id, jogadores, devedor };
}

async function verificar(sessionId: number, player: { id: number; nome: string }) {
  const session = await turnoRepository.findSessionComJogadores(sessionId);
  return turnoService.verificarFalencia(sessionId, session!, player);
}

async function irParaRodada(sessionId: number, rodada: number) {
  await prisma.session.update({ where: { id: sessionId }, data: { rodadaAtual: rodada } });
}

describe("Falência (Modo Tabuleiro)", () => {
  it("(a) 3 turnos devendo: propriedades voltam ao banco, saldo zera e o turno vai para o próximo ativo", async () => {
    const { sessionId, jogadores, devedor } = await cenario(4);
    // Uma com casas e uma hipotecada (hipoteca tira o playerId e guarda lastOwnerId).
    await prisma.sessionPosses.create({ data: { sessionId, propId: PROPS[0], playerId: devedor.id, casas: 2 } });
    await prisma.sessionPosses.create({ data: { sessionId, propId: PROPS[1], playerId: null, lastOwnerId: devedor.id, hipotecada: true } });

    expect(await verificar(sessionId, devedor)).toBeNull();
    await irParaRodada(sessionId, 2);
    expect(await verificar(sessionId, devedor)).toBeNull();
    expect((await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: devedor.id } })).rodadasDevendo).toBe(2);
    await irParaRodada(sessionId, 3);
    const resultado: any = await verificar(sessionId, devedor);

    expect(resultado?.falido).toBe(true);
    expect(resultado.turnoAtualPlayerId).toBe(jogadores[1].id);

    const falido = await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: devedor.id } });
    expect(falido).toMatchObject({ saldo: 0, desistiu: true, motivoDesistencia: "FALENCIA", rodadasDevendo: 0 });
    expect(falido.desistiuEm).not.toBeNull();

    const posses = await prisma.sessionPosses.findMany({ where: { sessionId } });
    expect(posses).toHaveLength(2);
    for (const p of posses) {
      expect(p).toMatchObject({ playerId: null, lastOwnerId: null, casas: 0, hipotecada: false });
    }
    expect(await prisma.historico.count({ where: { sessionId, tipo: "FALENCIA" } })).toBe(1);
  });

  it("conta no máximo uma vez por turno (duplo rola de novo no mesmo turno)", async () => {
    const { sessionId, devedor } = await cenario(4);

    await verificar(sessionId, devedor);
    await verificar(sessionId, devedor);
    await verificar(sessionId, devedor);

    const p = await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: devedor.id } });
    expect(p.rodadasDevendo).toBe(1);
    expect(p.desistiu).toBe(false);
  });

  it("(a) pelo rolarDados: o 3º turno devendo falha antes de rolar", async () => {
    const { sessionId, jogadores, devedor } = await cenario(4);
    await prisma.sessionPlayer.update({ where: { id: devedor.id }, data: { rodadasDevendo: 2, rodadaContagemDivida: 0 } });

    const resultado: any = await turnoService.rolarDados(sessionId, devedor.id);

    expect(resultado.falido).toBe(true);
    expect(resultado.turnoAtualPlayerId).toBe(jogadores[1].id);
    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.aguardandoEscolha).toBe(false);
  });

  it("(b) com empréstimo: garantia executada antes da limpeza e casas dos irmãos vendidas", async () => {
    const { sessionId, devedor } = await cenario(4);
    // Monopólio do grupo: garantia com 1 casa, irmão com 2, irmão sem casa.
    await prisma.sessionPosses.create({ data: { sessionId, propId: PROPS[0], playerId: devedor.id, casas: 1 } });
    await prisma.sessionPosses.create({ data: { sessionId, propId: PROPS[1], playerId: devedor.id, casas: 2 } });
    await prisma.sessionPosses.create({ data: { sessionId, propId: PROPS[2], playerId: devedor.id, casas: 0 } });
    const emp = await prisma.emprestimo.create({
      data: { sessionId, playerId: devedor.id, valorOriginal: 1000, valorDevido: 1200, garantiaPropId: PROPS[0] },
    });
    await prisma.sessionPlayer.update({ where: { id: devedor.id }, data: { rodadasDevendo: 2, rodadaContagemDivida: 0 } });

    const resultado: any = await verificar(sessionId, devedor);
    expect(resultado?.falido).toBe(true);

    expect(await prisma.emprestimo.findUniqueOrThrow({ where: { id: emp.id } })).toMatchObject({ executado: true, quitado: true });

    // Ordem: venda das casas do irmão e execução da garantia ANTES da falência.
    const historico = await prisma.historico.findMany({ where: { sessionId }, orderBy: { id: "asc" } });
    const tipos = historico.map(h => h.tipo);
    expect(tipos).toEqual(expect.arrayContaining(["VENDA_CASA_GARANTIA", "GARANTIA_EXECUTADA", "FALENCIA"]));
    expect(tipos.indexOf("VENDA_CASA_GARANTIA")).toBeLessThan(tipos.indexOf("FALENCIA"));
    expect(tipos.indexOf("GARANTIA_EXECUTADA")).toBeLessThan(tipos.indexOf("FALENCIA"));
    // Só o irmão com casas é vendido (2 casas de PROPS[1]); a garantia sai inteira.
    expect(historico.find(h => h.tipo === "VENDA_CASA_GARANTIA")?.detalhes).toContain("2 casa(s)");

    const posses = await prisma.sessionPosses.findMany({ where: { sessionId } });
    for (const p of posses) {
      expect(p).toMatchObject({ playerId: null, lastOwnerId: null, casas: 0, hipotecada: false });
    }
    // O reembolso das casas não sobrevive à falência.
    expect((await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: devedor.id } })).saldo).toBe(0);
  });

  it("(c) quitar a dívida antes do 3º turno zera o contador e evita a falência", async () => {
    const { sessionId, devedor } = await cenario(4);
    await prisma.sessionPlayer.update({ where: { id: devedor.id }, data: { saldo: 20000 } });

    await verificar(sessionId, devedor);
    await irParaRodada(sessionId, 2);
    await verificar(sessionId, devedor);

    const divida = await prisma.debt.findFirstOrThrow({ where: { sessionId, playerId: devedor.id } });
    await new DividaService().pagarDivida(divida.id, devedor.id);
    expect((await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: devedor.id } })).rodadasDevendo).toBe(0);

    await irParaRodada(sessionId, 3);
    expect(await verificar(sessionId, devedor)).toBeNull();
    const p = await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: devedor.id } });
    expect(p).toMatchObject({ desistiu: false, rodadasDevendo: 0 });
  });

  it("(d) o falido sai da ordem e a partida segue sem travar", async () => {
    const { sessionId, jogadores, devedor } = await cenario(4);
    await prisma.sessionPlayer.update({ where: { id: devedor.id }, data: { rodadasDevendo: 2, rodadaContagemDivida: 0 } });
    await verificar(sessionId, devedor);

    const vezes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
      vezes.push(session.turnoAtualPlayerId!);
      await turnoService.passarVez(sessionId, session.turnoAtualPlayerId!);
    }

    expect(vezes).not.toContain(devedor.id);
    const ativos = jogadores.slice(1).map(j => j.id);
    expect(vezes).toEqual([...ativos, ...ativos, ativos[0]]);
    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.rodadaAtual).toBeGreaterThan(1);
  });

  it("(e) encerra a partida quando metade ou mais dos jogadores saiu", async () => {
    const { sessionId, devedor } = await cenario(2);
    await prisma.sessionPlayer.update({ where: { id: devedor.id }, data: { rodadasDevendo: 2, rodadaContagemDivida: 0 } });

    const resultado: any = await verificar(sessionId, devedor);

    expect(resultado).toMatchObject({ falido: true, autoEnded: true });
    expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
    expect(await prisma.gameResult.count({ where: { sessionId } })).toBe(2);
    expect(emitSessionClosed).toHaveBeenCalledWith(sessionId, expect.any(Array));
  });

  it("(e) com 4 jogadores e um já fora, a falência do segundo encerra (2 de 4 ativos)", async () => {
    const { sessionId, jogadores, devedor } = await cenario(4);
    await prisma.sessionPlayer.update({
      where: { id: jogadores[3].id },
      data: { desistiu: true, motivoDesistencia: "VOLUNTARIA", desistiuEm: new Date() },
    });
    await prisma.sessionPlayer.update({ where: { id: devedor.id }, data: { rodadasDevendo: 2, rodadaContagemDivida: 0 } });

    const resultado: any = await verificar(sessionId, devedor);

    expect(resultado.autoEnded).toBe(true);
    expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
  });

  it("(e) com 4 jogadores, uma falência só não encerra (3 de 4 ativos)", async () => {
    const { sessionId, devedor } = await cenario(4);
    await prisma.sessionPlayer.update({ where: { id: devedor.id }, data: { rodadasDevendo: 2, rodadaContagemDivida: 0 } });

    const resultado: any = await verificar(sessionId, devedor);

    expect(resultado.autoEnded).toBeUndefined();
    expect(await prisma.session.findUnique({ where: { id: sessionId } })).not.toBeNull();
    expect(emitSessionClosed).not.toHaveBeenCalled();
  });
});
