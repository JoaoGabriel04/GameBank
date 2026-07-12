import { jest } from "@jest/globals";

// Mesmo padrão de banco.test.ts: sem socket real nos testes, as emissões
// viram no-op.
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
const { turnoService } = await import("../../modules/turno/turno.service.js");
const { leilaoService } = await import("../../modules/leilao/leilao.service.js");
const { timerService } = await import("../../modules/turno/services/timer.service.js");

describe("Fase 2 — orquestrador de turno + serviços extraídos", () => {
  it("fluxo completo: rolar, escolher movimento, resolver casa (com leilão se cair em propriedade livre) e passar a vez", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    await prisma.session.update({ where: { id: sessao.id }, data: { tipoJogo: "tabuleiro" } });
    const p1 = await criarPlayer(sessao.id, owner.id, { nome: "P1", saldo: 25000 });
    const p2 = await criarPlayer(sessao.id, null, { nome: "P2", cor: "Vermelho", saldo: 25000 });

    const { turnoAtualPlayerId } = await turnoService.iniciarTurnos(sessao.id, [p1.id, p2.id]);
    expect([p1.id, p2.id]).toContain(turnoAtualPlayerId);

    // Rola até sair do estado de prisão/3-duplos e chegar em aguardandoEscolha
    // (fluxo determinístico apesar do dado ser aleatório — no pior caso o
    // turno avança e testamos com o próximo jogador).
    let atualId = turnoAtualPlayerId!;
    let rolou: any = null;
    for (let tentativa = 0; tentativa < 10 && !rolou?.aguardandoEscolha; tentativa++) {
      const session = await prisma.session.findUniqueOrThrow({ where: { id: sessao.id } });
      atualId = session.turnoAtualPlayerId!;
      rolou = await turnoService.rolarDados(sessao.id, atualId);
    }

    if (rolou.aguardandoEscolha) {
      const escolhido = await turnoService.escolherMovimento(sessao.id, atualId, "soma");
      expect(escolhido).toBeDefined();

      if (escolhido.aguardandoAcao && escolhido.compraDisponivel) {
        // Recusa a compra — dispara o Leilão Cego (Mecânica 4). Testa que
        // leilao.service e turno.service coordenam sem deadlock.
        const recusa: any = await turnoService.recusarCompra(sessao.id, atualId);
        expect(recusa.leilaoIniciado).toBe(true);

        const sessaoLeilao = await prisma.session.findUniqueOrThrow({ where: { id: sessao.id } });
        expect(sessaoLeilao.emLeilao).toBe(true);

        const outroId = atualId === p1.id ? p2.id : p1.id;
        await leilaoService.darLance(sessao.id, atualId, 0); // passa
        const resultado: any = await leilaoService.darLance(sessao.id, outroId, sessaoLeilao.leilaoLanceMinimo ?? 100);
        expect(resultado.leilaoEncerrado).toBe(true);

        const sessaoPosLeilao = await prisma.session.findUniqueOrThrow({ where: { id: sessao.id } });
        expect(sessaoPosLeilao.emLeilao).toBe(false);
      }
    }

    // Turno avança sem lançar exceção nem travar (o que provaria ausência
    // de deadlock entre os locks turno:${id} e leilao:${id}).
    const sessaoFinal = await prisma.session.findUniqueOrThrow({ where: { id: sessao.id } });
    if (!sessaoFinal.emLeilao && !sessaoFinal.aguardandoAcao) {
      const passou = await turnoService.passarVez(sessao.id, sessaoFinal.turnoAtualPlayerId!);
      expect(passou.avancou).toBe(true);
    }
  }, 30_000);

  it("timers: avancarPorTimeout e varreduras rodam sem lançar exceção", async () => {
    const owner = await criarUsuario();
    const sessao = await criarSessao(owner.id);
    await prisma.session.update({ where: { id: sessao.id }, data: { tipoJogo: "tabuleiro" } });
    const p1 = await criarPlayer(sessao.id, owner.id, { nome: "P1", saldo: 25000 });
    const p2 = await criarPlayer(sessao.id, null, { nome: "P2", cor: "Vermelho", saldo: 25000 });

    await turnoService.iniciarTurnos(sessao.id, [p1.id, p2.id]);

    // Simula timeout expirado sem esperar 60s de verdade.
    await expect(timerService.avancarPorTimeout(sessao.id)).resolves.toBeDefined();

    // Varreduras periódicas (BUG 6) — devem ser no-op silencioso quando
    // nada está de fato travado.
    await expect(timerService.varrerTurnosExpirados()).resolves.toBeUndefined();
    await expect(leilaoService.varrerLeiloesExpirados()).resolves.toBeUndefined();
    await expect(timerService.recoverStuckSessions()).resolves.toBeUndefined();
  }, 30_000);
});
