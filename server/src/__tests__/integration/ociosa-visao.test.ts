import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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
  emitTurnoTimeout: jest.fn(),
}));

const { prisma } = await import("../../lib/prisma.js");
const { criarUsuario, criarSessao, criarPlayer } = await import("../helpers/factories.js");
const { rodadaService } = await import("../../modules/turno/services/rodada.service.js");
const { casaResolverService } = await import("../../modules/turno/services/casa-resolver.service.js");
const { turnoService } = await import("../../modules/turno/turno.service.js");
const { PropriedadeService } = await import("../../modules/propriedade/propriedade.service.js");
const { NegociacaoService } = await import("../../modules/negociacao/negociacao.service.js");
const {
  RENDA_PASSIVA_PCT, OCIOSA_REGRA, VISAO_CREDITOS_MAX, VISAO_RECARGA_RODADAS,
} = await import("../../constants/economia.js");
const { calcularCustoOciosa } = await import("../../shared/economia-core.js");

const propriedadeService = new PropriedadeService();
const negociacaoService = new NegociacaoService();

// Propriedades exclusivas deste teste (ids fixos, grupo próprio — o
// monopólio é por sessão, então as duas formam um grupo completo).
const PROP_A = 900101;
const PROP_B = 900102;
const PROP_BASE = {
  grupo_cor: "TesteOciosa", tipo: "normal", custo_compra: 2400,
  aluguel_base: 100, aluguel_1c: 200, aluguel_2c: 300, aluguel_3c: 400,
  aluguel_4c: 500, aluguel_hotel: 600, custo_casa: 500, hipoteca: 1200,
};
const RENDA_A = Math.round(PROP_BASE.aluguel_base * RENDA_PASSIVA_PCT);

beforeAll(async () => {
  for (const id of [PROP_A, PROP_B]) {
    await prisma.propriedade.upsert({
      where: { id },
      create: { id, nome: `Terreno Teste ${id}`, ...PROP_BASE },
      update: {},
    });
  }
});

async function cenario(opts: { rodadaAtual: number; ultimaAtividadeRodada: number; saldo?: number }) {
  const owner = await criarUsuario();
  const sessao = await criarSessao(owner.id);
  await prisma.session.update({
    where: { id: sessao.id },
    data: { tipoJogo: "tabuleiro", rodadaAtual: opts.rodadaAtual },
  });
  const p1 = await criarPlayer(sessao.id, owner.id, { nome: "Dono", saldo: opts.saldo ?? 25000 });
  const p2 = await criarPlayer(sessao.id, null, { nome: "Outro", cor: "Vermelho" });
  const posseA = await prisma.sessionPosses.create({
    data: { sessionId: sessao.id, propId: PROP_A, playerId: p1.id, ultimaAtividadeRodada: opts.ultimaAtividadeRodada },
  });
  const posseB = await prisma.sessionPosses.create({
    data: { sessionId: sessao.id, propId: PROP_B, playerId: p2.id, ultimaAtividadeRodada: opts.rodadaAtual },
  });
  return { sessao, p1, p2, posseA, posseB };
}

// Virada direta, sem evento econômico (evita sorteio aleatório).
const virarRodada = (sessionId: number, novaRodada: number) =>
  rodadaService.processarViradaDeRodada(sessionId, novaRodada, { eventoAtual: null, eventoProximo: null, eventoRodadasRestantes: 0 });

const saldoDe = async (playerId: number) =>
  (await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: playerId } })).saldo;
const atividadeDe = async (posseId: number) =>
  (await prisma.sessionPosses.findUniqueOrThrow({ where: { id: posseId } })).ultimaAtividadeRodada;

const custoEsperado = (ociosas: number) =>
  calcularCustoOciosa({ tipo: "normal", custo_compra: PROP_BASE.custo_compra }, 0, false, ociosas, {}, OCIOSA_REGRA);

describe("Terreno ocioso — cobrança na virada de rodada", () => {
  it("cobra do dono após a carência e registra no histórico", async () => {
    const carencia = OCIOSA_REGRA.carenciaRodadas;
    const { sessao, p1 } = await cenario({ rodadaAtual: carencia + 1, ultimaAtividadeRodada: 1 });

    await virarRodada(sessao.id, carencia + 1);

    expect(await saldoDe(p1.id)).toBe(25000 + RENDA_A - custoEsperado(carencia));
    const h = await prisma.historico.findFirst({ where: { sessionId: sessao.id, tipo: "TERRENO_OCIOSO" } });
    expect(h?.detalhes).toContain(`Terreno Teste ${PROP_A}`);
    expect(h?.detalhes).toContain(`(${carencia} rodadas sem visita)`);
  });

  it("não cobra antes da carência", async () => {
    const carencia = OCIOSA_REGRA.carenciaRodadas;
    const { sessao, p1 } = await cenario({ rodadaAtual: carencia, ultimaAtividadeRodada: 1 });

    await virarRodada(sessao.id, carencia);

    expect(await saldoDe(p1.id)).toBe(25000 + RENDA_A);
    expect(await prisma.historico.count({ where: { sessionId: sessao.id, tipo: "TERRENO_OCIOSO" } })).toBe(0);
  });

  it("saldo insuficiente vira dívida, nunca saldo negativo", async () => {
    const rodada = 30;
    const { sessao, p1 } = await cenario({ rodadaAtual: rodada, ultimaAtividadeRodada: 1, saldo: 0 });

    await virarRodada(sessao.id, rodada);

    expect(await saldoDe(p1.id)).toBe(0);
    const divida = await prisma.debt.findFirst({ where: { sessionId: sessao.id, playerId: p1.id, pago: false } });
    expect(divida?.valor).toBe(custoEsperado(rodada - 1) - RENDA_A);
  });

  it("backfill da migration não cobra retroativamente em partida em andamento", async () => {
    const { sessao, p1, posseA } = await cenario({ rodadaAtual: 40, ultimaAtividadeRodada: 0 });

    // Mesmo UPDATE da migration 20261018231000_ultima_atividade_rodada,
    // restrito à sessão do teste.
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const sql = readFileSync(
      resolve(__dirname, "../../../prisma/migrations/20261018231000_ultima_atividade_rodada/migration.sql"),
      "utf8"
    );
    const backfill = sql.slice(sql.indexOf("UPDATE")).trim().replace(/;$/, "");
    await prisma.$executeRawUnsafe(`${backfill} AND s.id = ${sessao.id}`);
    expect(await atividadeDe(posseA.id)).toBe(40);

    await virarRodada(sessao.id, 41);
    expect(await saldoDe(p1.id)).toBe(25000 + RENDA_A);
  });
});

describe("Terreno ocioso — eventos que zeram o contador", () => {
  it("visita (qualquer jogador terminando o movimento na casa) zera", async () => {
    // Casa 1 do tabuleiro real é a propriedade 1 (Av. 9 de Julho).
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    await prisma.session.update({ where: { id: sessao.id }, data: { tipoJogo: "tabuleiro", rodadaAtual: 12 } });
    const dono = await criarPlayer(sessao.id, owner.id, { nome: "Dono" });
    const visitante = await criarPlayer(sessao.id, null, { nome: "Visitante", cor: "Vermelho" });
    await prisma.propriedade.upsert({
      where: { id: 1 },
      create: {
        id: 1, nome: "Av. 9 de Julho", grupo_cor: "Verde-Claro", tipo: "normal", custo_compra: 1000,
        aluguel_base: 60, aluguel_1c: 300, aluguel_2c: 900, aluguel_3c: 2700, aluguel_4c: 4000,
        aluguel_hotel: 5000, custo_casa: 500, hipoteca: 500,
      },
      update: {},
    });
    const posse = await prisma.sessionPosses.create({
      data: { sessionId: sessao.id, propId: 1, playerId: dono.id, ultimaAtividadeRodada: 1 },
    });

    await casaResolverService.resolverCasa(
      sessao.id,
      { id: visitante.id, nome: visitante.nome, posicao: 1, saldo: visitante.saldo },
      7,
      {}
    );

    expect(await atividadeDe(posse.id)).toBe(12);
  });

  it("construir casa zera", async () => {
    const { sessao, p1, posseA } = await cenario({ rodadaAtual: 15, ultimaAtividadeRodada: 1 });
    // Monopólio do grupo de teste + vez do dono (exigida no Modo Tabuleiro).
    await prisma.sessionPosses.updateMany({ where: { sessionId: sessao.id }, data: { playerId: p1.id } });
    await prisma.session.update({ where: { id: sessao.id }, data: { turnoAtualPlayerId: p1.id } });

    await propriedadeService.buyHouse(p1.id, sessao.id, PROP_A);

    expect(await atividadeDe(posseA.id)).toBe(15);
  });

  it("hipotecar zera, e recomprar a hipoteca zera de novo", async () => {
    const { sessao, p1, posseA } = await cenario({ rodadaAtual: 10, ultimaAtividadeRodada: 1 });

    await propriedadeService.hipotecarPropriedade(PROP_A, sessao.id, p1.id);
    expect(await atividadeDe(posseA.id)).toBe(10);

    await prisma.session.update({ where: { id: sessao.id }, data: { rodadaAtual: 13 } });
    await propriedadeService.comprarHipotecada(posseA.id, sessao.id, p1.id);
    expect(await atividadeDe(posseA.id)).toBe(13);
  });

  it("troca por negociação zera", async () => {
    const { sessao, p1, p2, posseA } = await cenario({ rodadaAtual: 20, ultimaAtividadeRodada: 1 });
    const negociacao = await prisma.negotiation.create({
      data: {
        sessionId: sessao.id, fromPlayerId: p1.id, toPlayerId: p2.id, status: "pendente",
        expiresAt: new Date(Date.now() + 60_000),
        items: { create: [{ sessionPossesId: posseA.id, fromSide: true, valor: null }] },
      },
    });

    await negociacaoService.aceitarNegociacao(negociacao.id, p2.id);

    const posse = await prisma.sessionPosses.findUniqueOrThrow({ where: { id: posseA.id } });
    expect(posse.playerId).toBe(p2.id);
    expect(posse.ultimaAtividadeRodada).toBe(20);
  });
});

describe("Créditos de visão", () => {
  async function sessaoAguardandoEscolha(rodadaAtual: number) {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    const p1 = await criarPlayer(sessao.id, owner.id, { nome: "P1" });
    await prisma.session.update({
      where: { id: sessao.id },
      data: {
        tipoJogo: "tabuleiro", rodadaAtual, turnoAtualPlayerId: p1.id,
        aguardandoEscolha: true, ultimoDado1: 3, ultimoDado2: 4,
      },
    });
    return { sessao, p1 };
  }

  it("novo jogador começa com VISAO_CREDITOS_MAX créditos", async () => {
    const { p1 } = await sessaoAguardandoEscolha(1);
    expect(p1.creditoVisao).toBe(VISAO_CREDITOS_MAX);
  });

  it("ao zerar agenda a recarga e, na rodada da recarga, volta a ter crédito", async () => {
    const { sessao, p1 } = await sessaoAguardandoEscolha(5);

    const r = await turnoService.revelarDados(sessao.id, p1.id);
    expect(r.creditosRestantes).toBe(VISAO_CREDITOS_MAX - 1);

    let jogador = await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: p1.id } });
    expect(jogador.creditoVisao).toBe(0);
    expect(jogador.creditoRecargaEm).toBe(5 + VISAO_RECARGA_RODADAS);

    // Antes da recarga: sem crédito.
    await expect(turnoService.revelarDados(sessao.id, p1.id)).rejects.toMatchObject({ statusCode: 400 });

    // Na rodada da recarga: recarrega e consome de novo.
    await prisma.session.update({ where: { id: sessao.id }, data: { rodadaAtual: 5 + VISAO_RECARGA_RODADAS } });
    const r2 = await turnoService.revelarDados(sessao.id, p1.id);
    expect(r2.creditosRestantes).toBe(VISAO_CREDITOS_MAX - 1);
    jogador = await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: p1.id } });
    expect(jogador.creditoRecargaEm).toBe(5 + 2 * VISAO_RECARGA_RODADAS);
  });

  it("dois cliques simultâneos em revelar não gastam dois créditos", async () => {
    const { sessao, p1 } = await sessaoAguardandoEscolha(3);

    const resultados = await Promise.allSettled([
      turnoService.revelarDados(sessao.id, p1.id),
      turnoService.revelarDados(sessao.id, p1.id),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const jogador = await prisma.sessionPlayer.findUniqueOrThrow({ where: { id: p1.id } });
    expect(jogador.creditoVisao).toBe(0);
  });
});
