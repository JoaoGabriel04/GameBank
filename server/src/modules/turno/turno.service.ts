import { AppError } from "../../middleware/error-handler.middleware.js";
import { withLock } from "../../middleware/lock.middleware.js";
import { turnoRepository } from "./turno.repository.js";
import { sessionLogger } from "../../lib/logger.js";
import { TOTAL_CASAS, POS_PRISAO, CREDITO_INICIO, MULTA_PRISAO, getCasa, type Casa } from "../tabuleiro/tabuleiro.data.js";
import { PropriedadeRepository } from "../propriedade/propriedade.repository.js";
import { PropriedadeService } from "../propriedade/propriedade.service.js";
import { CartaService } from "../carta/carta.service.js";

const propriedadeRepository = new PropriedadeRepository();
const propriedadeService = new PropriedadeService();
const cartaService = new CartaService();

const TURNO_TIMEOUT_MS = 60_000;

// Timers de turno em memória por sessionId. Como o dado é transitório
// (só importa "há um timer pendente agora") e a app roda como instância
// única no Render, não precisa de Redis — mesmo padrão de fallback em
// memória já usado em socket.ts (activeSockets).
const turnoTimers = new Map<number, NodeJS.Timeout>();

// Duplos consecutivos do jogador na vez atual — reseta a cada troca de
// turno. Em memória (mesmo racional dos timers): só importa "agora".
const duplosConsecutivos = new Map<number, number>();

function cancelTurnoTimer(sessionId: number) {
  const timer = turnoTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    turnoTimers.delete(sessionId);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function parseOrdem(ordemTurnos: string | null): number[] {
  if (!ordemTurnos) return [];
  try {
    const parsed = JSON.parse(ordemTurnos);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

class TurnoService {
  // Chamado pelo SessionService.startSession quando tipoJogo === "tabuleiro".
  async iniciarTurnos(sessionId: number, jogadorIds: number[]) {
    const ordem = shuffle(jogadorIds);
    const primeiro = ordem[0] ?? null;

    await turnoRepository.updateTurno(sessionId, {
      ordemTurnos: JSON.stringify(ordem),
      turnoAtualPlayerId: primeiro,
      turnoIniciadoEm: primeiro ? new Date() : null,
      aguardandoAcao: false,
    });

    if (primeiro) await this.agendarTimeout(sessionId);
    return { ordem, turnoAtualPlayerId: primeiro };
  }

  async passarVez(sessionId: number, playerIdAtual: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);

      if (session.turnoAtualPlayerId !== playerIdAtual) {
        throw new AppError(403, "Não é sua vez de jogar.");
      }

      return this.avancarTurno(sessionId, session);
    });
  }

  async rolarDados(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);

      if (session.turnoAtualPlayerId !== playerId) {
        throw new AppError(403, "Não é sua vez de jogar.");
      }
      if (session.aguardandoAcao) {
        throw new AppError(400, "Resolva a ação pendente antes de rolar os dados.");
      }

      const player = await turnoRepository.findPlayerParaJogada(playerId);
      if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");

      const falencia = await this.verificarFalencia(sessionId, session, player);
      if (falencia) return falencia;

      if (player.emPrisao) {
        return this.rolarDadosEmPrisao(sessionId, session, player);
      }

      const dado1 = Math.floor(Math.random() * 6) + 1;
      const dado2 = Math.floor(Math.random() * 6) + 1;
      const duplo = dado1 === dado2;

      const contagemAnterior = duplosConsecutivos.get(playerId) ?? 0;
      const contagemAtual = duplo ? contagemAnterior + 1 : 0;
      duplosConsecutivos.set(playerId, contagemAtual);

      // 3 duplos seguidos → prisão direta, sem completar o movimento e
      // sem jogar de novo.
      if (contagemAtual >= 3) {
        duplosConsecutivos.set(playerId, 0);
        await turnoRepository.moverPlayer(playerId, { posicao: POS_PRISAO, emPrisao: true, turnosPrisao: 3 });
        await turnoRepository.registrarDados(sessionId, { ultimoDado1: dado1, ultimoDado2: dado2, aguardandoAcao: false });

        const avanco = await this.avancarTurno(sessionId, session);
        return { dado1, dado2, duplo: true, foiPreso: true, novaPosicao: POS_PRISAO, passouInicio: false, ...avanco };
      }

      await turnoRepository.registrarDados(sessionId, { ultimoDado1: dado1, ultimoDado2: dado2, aguardandoAcao: true });
      const { novaPosicao, passouInicio, resolucao } = await this.moverEResolver(sessionId, player, dado1 + dado2);

      // Auto-avança o turno após jogada sem duplos (a menos que haja ação pendente)
      if (!duplo && !resolucao.aguardandoAcao) {
        const avanco = await this.avancarTurno(sessionId, session);
        return { dado1, dado2, duplo, foiPreso: false, novaPosicao, passouInicio, ...resolucao, ...avanco };
      }

      // Duplo ou ação pendente: não avança o turno, mas reseta o timer
      await this.agendarTimeout(sessionId);
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return { dado1, dado2, duplo, foiPreso: false, novaPosicao, passouInicio, ...resolucao };
    });
  }

  // Move o jogador `total` casas (com crédito de início se aplicável) e
  // dispara resolverCasa — compartilhado entre a rolagem normal e a saída
  // (com sucesso ou forçada) da prisão.
  private async moverEResolver(
    sessionId: number,
    player: { id: number; nome: string; posicao: number; saldo: number },
    total: number
  ) {
    const novaPosicao = (player.posicao + total) % TOTAL_CASAS;
    const passouInicio = (player.posicao + total) >= TOTAL_CASAS;
    const saldoAposInicio = passouInicio ? player.saldo + CREDITO_INICIO : player.saldo;

    await turnoRepository.moverPlayer(player.id, {
      posicao: novaPosicao,
      ...(passouInicio ? { saldo: saldoAposInicio } : {}),
    });

    const resolucao = await this.resolverCasa(sessionId, { ...player, posicao: novaPosicao, saldo: saldoAposInicio }, total);

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return { novaPosicao, passouInicio, resolucao };
  }

  // Rodadas 1-2 presas: 1 tentativa de duplo (falhou → turnosPrisao--,
  // permanece preso, turno acaba). Rodada 3 (turnosPrisao===1): até 3
  // tentativas na mesma vez; se as 3 falharem, paga a multa e sai.
  private async rolarDadosEmPrisao(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    player: { id: number; nome: string; posicao: number; saldo: number; turnosPrisao: number; tentativasPrisao: number }
  ) {
    const dado1 = Math.floor(Math.random() * 6) + 1;
    const dado2 = Math.floor(Math.random() * 6) + 1;
    const duplo = dado1 === dado2;
    await turnoRepository.registrarDados(sessionId, { ultimoDado1: dado1, ultimoDado2: dado2, aguardandoAcao: false });

    if (duplo) {
      await turnoRepository.moverPlayer(player.id, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });
      await turnoRepository.setAguardandoAcao(sessionId, false);
      await this.agendarTimeout(sessionId);
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      // Sai da prisão mas permanece na casa Prisão (pos 10) — ganha outra
      // jogada (duplo=true → rolarDados não avança o turno).
      return { dado1, dado2, duplo: true, escapouPrisao: true, novaPosicao: player.posicao, passouInicio: false, aguardandoAcao: false };
    }

    const ultimaRodada = player.turnosPrisao <= 1;

    if (!ultimaRodada) {
      await turnoRepository.moverPlayer(player.id, { turnosPrisao: player.turnosPrisao - 1 });
      const avanco = await this.avancarTurno(sessionId, session);
      return { dado1, dado2, duplo: false, escapouPrisao: false, aindaPreso: true, ...avanco };
    }

    const tentativas = player.tentativasPrisao + 1;
    if (tentativas < 3) {
      await turnoRepository.moverPlayer(player.id, { tentativasPrisao: tentativas });
      await this.agendarTimeout(sessionId);
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      return { dado1, dado2, duplo: false, escapouPrisao: false, aindaPreso: true, tentativasPrisao: tentativas };
    }

    // 3ª tentativa falhou — paga a multa e sai sem andar, encerra a vez
    await this.cobrarComFallbackDivida(
      sessionId, player, MULTA_PRISAO, null, `Multa de R$ ${MULTA_PRISAO} — não conseguiu sair da prisão`
    );
    await turnoRepository.moverPlayer(player.id, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });

    const avanco = await this.avancarTurno(sessionId, session);
    return {
      dado1, dado2, duplo: false, escapouPrisao: true, pagouMulta: true,
      novaPosicao: player.posicao, passouInicio: false, ...avanco,
    };
  }

  private async verificarFalencia(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    player: { id: number; nome: string }
  ) {
    const { prisma } = await import("../../lib/prisma.js");
    const dividaAtiva = await prisma.debt.findFirst({ where: { sessionId, playerId: player.id, pago: false } });
    if (!dividaAtiva) return null;

    const atual = await prisma.sessionPlayer.findUnique({ where: { id: player.id }, select: { rodadasDevendo: true, saldo: true } });
    const rodadas = (atual?.rodadasDevendo ?? 0) + 1;

    if (rodadas < 3) {
      await prisma.sessionPlayer.update({ where: { id: player.id }, data: { rodadasDevendo: rodadas } });
      return null;
    }

    // Calcula patrimônio antes de limpar (para ranking)
    const posses = await prisma.sessionPosses.findMany({
      where: { sessionId, playerId: player.id },
      include: { propriedade: true },
    });
    let patrimony = atual?.saldo ?? 0;
    for (const sp of posses) {
      if (sp.propriedade) {
        patrimony += sp.propriedade.custo_compra;
        patrimony += sp.casas * sp.propriedade.custo_casa;
      }
    }

    // Falência: propriedades voltam ao banco (sem dono, sem leilão),
    // jogador marcado como falido e removido dos turnos.
    await prisma.$transaction(async (tx) => {
      await tx.sessionPlayer.update({
        where: { id: player.id },
        data: { patrimonyAtDesistir: patrimony },
      });
      await tx.sessionPosses.updateMany({
        where: { sessionId, playerId: player.id },
        data: { playerId: null, casas: 0, hipotecada: false, negociando: false },
      });
      await tx.sessionPlayer.update({
        where: { id: player.id },
        data: { saldo: 0, desistiu: true, motivoDesistencia: "FALENCIA", desistiuEm: new Date(), rodadasDevendo: 0 },
      });
      await tx.historico.create({
        data: { sessionId, data: new Date(), tipo: "FALENCIA", detalhes: `${player.nome} faliu — 3 rodadas sem quitar dívidas.` },
      });
    });

    const avanco = await this.avancarTurno(sessionId, session);

    return { falido: true, ...avanco };
  }

  // Dispara automaticamente após o movimento (Fase 6). Resolve o que
  // acontece ao parar na casa; casas que exigem decisão do jogador
  // (comprar propriedade sem dono) deixam aguardandoAcao=true.
  private async resolverCasa(
    sessionId: number,
    player: { id: number; nome: string; posicao: number; saldo: number },
    numDados: number
  ) {
    const casa = getCasa(player.posicao);
    let aguardandoAcao = false;
    let compraDisponivel: { propId: number; sessionPossesId: number; nome: string; preco: number } | undefined;
    let mensagem = "";

    switch (casa.tipo) {
      case "propriedade":
      case "acao": {
        if (casa.propId == null) break;
        const posse = await propriedadeRepository.findSessionPosses(sessionId, casa.propId);
        if (!posse || !posse.propriedade) break;

        if (!posse.playerId) {
          aguardandoAcao = true;
          compraDisponivel = {
            propId: casa.propId,
            sessionPossesId: posse.id,
            nome: posse.propriedade.nome,
            preco: posse.propriedade.custo_compra,
          };
        } else if (posse.playerId !== player.id && !posse.hipotecada && posse.player) {
          const valor = casa.tipo === "acao"
            ? 500 * numDados
            : this.calcularAluguel(posse.propriedade, posse.casas);
          const r = await this.cobrarComFallbackDivida(
            sessionId, player, valor, posse.player,
            `Aluguel de R$ ${valor} em ${posse.propriedade.nome}`
          );
          mensagem = r.debtCriada
            ? `${player.nome} pagou R$ ${r.pago} e ficou devendo R$ ${r.debtValor} de aluguel em ${posse.propriedade.nome}.`
            : `${player.nome} pagou R$ ${valor} de aluguel em ${posse.propriedade.nome}.`;
          const { emitToRoom } = await import("../../lib/socket.js");
          emitToRoom(sessionId, "aluguel:toast", {
            fromPlayerNome: player.nome,
            toPlayerId: posse.player.id,
            toUserId: posse.player.userId,
            valor,
            propriedadeNome: posse.propriedade.nome,
          });
        }
        break;
      }

      case "noticias": {
        const sorteio = await cartaService.sortearCarta(sessionId, player.id);
        mensagem = sorteio.effectDescription;
        if (sorteio.carta.tipo === "prisao") {
          await turnoRepository.moverPlayer(player.id, { posicao: POS_PRISAO, emPrisao: true, turnosPrisao: 3 });
        }
        break;
      }

      case "restituicao": {
        const valor = casa.valor ?? 2000;
        await turnoRepository.moverPlayer(player.id, { saldo: player.saldo + valor });
        await turnoRepository.criarHistorico({ sessionId, tipo: "RESTITUICAO", detalhes: `${player.nome} recebeu R$ ${valor} de restituição do IR.` });
        mensagem = `${player.nome} recebeu R$ ${valor} de restituição.`;
        break;
      }

      case "imposto": {
        const valor = casa.valor ?? 2000;
        const r = await this.cobrarComFallbackDivida(sessionId, player, valor, null, `Imposto de R$ ${valor} (Receita Federal)`);
        mensagem = r.debtCriada
          ? `${player.nome} pagou R$ ${r.pago} de imposto e ficou devendo R$ ${r.debtValor}.`
          : `${player.nome} pagou R$ ${valor} de imposto.`;
        break;
      }

      case "feriado": {
        await turnoRepository.moverPlayer(player.id, { pularProximaRodada: true });
        mensagem = `${player.nome} caiu no Feriado e vai pular a próxima rodada.`;
        break;
      }

      case "va_para_prisao": {
        await turnoRepository.moverPlayer(player.id, { posicao: POS_PRISAO, emPrisao: true, turnosPrisao: 3 });
        mensagem = `${player.nome} foi direto para a prisão.`;
        break;
      }

      case "prisao_visita":
      case "inicio":
      default:
        break;
    }

    await turnoRepository.setAguardandoAcao(sessionId, aguardandoAcao);

    return { casa, aguardandoAcao, compraDisponivel, mensagem: mensagem || undefined };
  }

  private calcularAluguel(prop: { aluguel_base: number; aluguel_1c: number; aluguel_2c: number; aluguel_3c: number; aluguel_4c: number; aluguel_hotel: number }, casas: number) {
    switch (casas) {
      case 0: return prop.aluguel_base ?? 0;
      case 1: return prop.aluguel_1c ?? prop.aluguel_base ?? 0;
      case 2: return prop.aluguel_2c ?? prop.aluguel_1c ?? prop.aluguel_base ?? 0;
      case 3: return prop.aluguel_3c ?? prop.aluguel_2c ?? prop.aluguel_1c ?? prop.aluguel_base ?? 0;
      case 4: return prop.aluguel_4c ?? prop.aluguel_3c ?? prop.aluguel_2c ?? prop.aluguel_base ?? 0;
      default: return prop.aluguel_hotel ?? prop.aluguel_4c ?? prop.aluguel_base ?? 0;
    }
  }

  // Cobra valor do pagador; se saldo insuficiente, paga o que dá e cria
  // Debt pelo restante (mesmo padrão já usado em carta.service.ts pra
  // pagamentos automáticos do banco). credor=null → dinheiro vai pro banco.
  private async cobrarComFallbackDivida(
    sessionId: number,
    pagador: { id: number; nome: string; saldo: number },
    valor: number,
    credor: { id: number; nome: string; saldo: number } | null,
    descricao: string
  ) {
    const pago = Math.min(pagador.saldo, valor);
    const debtValor = valor - pago;

    await turnoRepository.moverPlayer(pagador.id, { saldo: pagador.saldo - pago });
    if (credor && pago > 0) {
      await turnoRepository.moverPlayer(credor.id, { saldo: credor.saldo + pago });
    }

    if (debtValor > 0) {
      await turnoRepository.criarDivida({ sessionId, playerId: pagador.id, valor: debtValor, descricao: `${descricao} (dívida)` });
    }

    await turnoRepository.criarHistorico({
      sessionId,
      tipo: credor ? "PAGAMENTO_ALUGUEL" : "IMPOSTO",
      detalhes: `${pagador.nome} pagou R$ ${pago}${debtValor > 0 ? ` e ficou devendo R$ ${debtValor}` : ""} — ${descricao}.`,
    });

    return { pago, debtCriada: debtValor > 0, debtValor };
  }

  async comprarCasaAtual(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarPendenciaDeCompra(sessionId, playerId);
      const casa = getCasa(session.posicaoJogador);
      if (casa.propId == null) throw new AppError(400, "Não há nada pra comprar nesta casa.");

      const resultado = await propriedadeService.buyProp(casa.propId, sessionId, playerId);
      await turnoRepository.setAguardandoAcao(sessionId, false);

      const foiDuplo = session.ultimoDado1 != null && session.ultimoDado1 === session.ultimoDado2;
      if (!foiDuplo) {
        const avanco = await this.avancarTurno(sessionId, session);
        return { ...resultado, ...avanco };
      }

      await this.agendarTimeout(sessionId);
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      return { ...resultado, turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false, duplo: true };
    });
  }

  async recusarCompra(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarPendenciaDeCompra(sessionId, playerId);
      await turnoRepository.setAguardandoAcao(sessionId, false);

      const foiDuplo = session.ultimoDado1 != null && session.ultimoDado1 === session.ultimoDado2;
      if (!foiDuplo) {
        const avanco = await this.avancarTurno(sessionId, session);
        return { recusado: true, ...avanco };
      }

      await this.agendarTimeout(sessionId);
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      return { recusado: true, turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false, duplo: true };
    });
  }

  async usarCartaPrisao(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);
      if (session.turnoAtualPlayerId !== playerId) throw new AppError(403, "Não é sua vez de jogar.");

      const player = await turnoRepository.findPlayerParaJogada(playerId);
      if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");
      if (!player.emPrisao) throw new AppError(400, "Você não está na prisão.");

      const mensagem = await cartaService.usarCartaPrisao(sessionId, playerId);
      await turnoRepository.moverPlayer(playerId, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });

      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return { mensagem };
    });
  }

  private async validarPendenciaDeCompra(sessionId: number, playerId: number) {
    const session = await this.validarESessaoAtiva(sessionId);
    if (session.turnoAtualPlayerId !== playerId) throw new AppError(403, "Não é sua vez de jogar.");
    if (!session.aguardandoAcao) throw new AppError(400, "Não há nenhuma compra pendente.");

    const player = await turnoRepository.findPlayerParaJogada(playerId);
    if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");

    return { ...session, posicaoJogador: player.posicao };
  }

  // Disparado pelo timeout de 60s — não valida "de quem é a vez" pois é
  // o próprio servidor avançando o turno atual.
  async avancarPorTimeout(sessionId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await turnoRepository.findSessionComJogadores(sessionId);
      if (!session || session.status !== "Em Andamento" || session.tipoJogo !== "tabuleiro") {
        cancelTurnoTimer(sessionId);
        return null;
      }

      // Timer pausa durante decisão obrigatória (ex: escolher o que vender)
      if (session.aguardandoAcao) {
        await this.agendarTimeout(sessionId);
        return null;
      }

      // Verifica falência do jogador que perdeu o tempo
      const atual = session.jogadores.find(j => j.id === session.turnoAtualPlayerId);
      if (atual) {
        const falencia = await this.verificarFalencia(sessionId, session, { id: atual.id, nome: atual.nome });
        if (falencia) return falencia;
      }

      return this.avancarTurno(sessionId, session, true);
    });
  }

  private async validarESessaoAtiva(sessionId: number) {
    const session = await turnoRepository.findSessionComJogadores(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");
    if (session.tipoJogo !== "tabuleiro") throw new AppError(400, "Sessão não é do Modo Tabuleiro");
    if (session.status !== "Em Andamento") throw new AppError(400, "Partida não está em andamento");

    // Fallback: se o timer do servidor não disparou, avança o turno na
    // primeira ação do jogador após o timeout.
    if (session.turnoIniciadoEm && !session.aguardandoAcao) {
      const elapsed = Date.now() - new Date(session.turnoIniciadoEm).getTime();
      if (elapsed >= TURNO_TIMEOUT_MS) {
        await this.avancarTurno(sessionId, session, true);
        throw new AppError(400, "Tempo da rodada expirou. Turno avançado automaticamente.");
      }
    }

    return session;
  }

  private async avancarTurno(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    porTimeout = false
  ) {
    const ordem = parseOrdem(session.ordemTurnos);
    if (ordem.length === 0) throw new AppError(400, "Ordem de turnos não definida");

    const jogadoresPorId = new Map(session.jogadores.map(j => [j.id, j]));
    const atualIdx = ordem.indexOf(session.turnoAtualPlayerId ?? -1);

    let proximo: { id: number; pularProximaRodada: boolean } | null = null;
    for (let step = 1; step <= ordem.length; step++) {
      const idx = (atualIdx + step) % ordem.length;
      const candidato = jogadoresPorId.get(ordem[idx]);
      if (!candidato || candidato.desistiu) continue;

      if (candidato.pularProximaRodada) {
        await turnoRepository.clearPularProximaRodada(candidato.id);
        continue; // pula a vez dele, mas ele já não pula a próxima
      }

      proximo = candidato;
      break;
    }

    // Turno de quem estava jogando terminou — zera contagem de duplos dele
    if (session.turnoAtualPlayerId != null) {
      duplosConsecutivos.delete(session.turnoAtualPlayerId);
      propriedadeService.limparConstrucoesTurno(sessionId, session.turnoAtualPlayerId);
    }

    // Ninguém mais ativo para jogar (edge case — o fluxo normal já
    // encerraria a partida antes disso via votação/falência)
    if (!proximo) {
      cancelTurnoTimer(sessionId);
      return { turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false };
    }

    await turnoRepository.updateTurno(sessionId, {
      turnoAtualPlayerId: proximo.id,
      turnoIniciadoEm: new Date(),
      aguardandoAcao: false,
    });

    await this.agendarTimeout(sessionId);

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    if (porTimeout) {
      const { emitTurnoTimeout } = await import("../socket/socket.handler.js");
      emitTurnoTimeout(sessionId, { jogadorAnteriorId: session.turnoAtualPlayerId });
    }

    return { turnoAtualPlayerId: proximo.id, avancou: true };
  }

  private async agendarTimeout(sessionId: number) {
    cancelTurnoTimer(sessionId);
    // Atualiza turnoIniciadoEm para o cliente reiniciar o contador
    try { await turnoRepository.updateTurno(sessionId, { turnoIniciadoEm: new Date() }); } catch {}
    const timer = setTimeout(async () => {
      try {
        await this.avancarPorTimeout(sessionId);
      } catch (err: any) {
        if (err?.statusCode === 423) {
          // Lock ocupado — retenta
          this.agendarTimeout(sessionId);
        } else {
          sessionLogger.error({ err, sessionId }, "erro ao avançar turno por timeout");
        }
      }
    }, TURNO_TIMEOUT_MS);
    turnoTimers.set(sessionId, timer);
  }

  cancelarTimeout(sessionId: number) {
    cancelTurnoTimer(sessionId);
  }

  async recoverStuckSessions() {
    const sessions = await turnoRepository.findSessionsStuck();
    const now = Date.now();
    for (const s of sessions) {
      if (!s.turnoIniciadoEm) continue;
      const elapsed = now - new Date(s.turnoIniciadoEm).getTime();
      if (elapsed >= TURNO_TIMEOUT_MS) {
        sessionLogger.warn({ sessionId: s.id, elapsed }, "recuperando sessão travada no startup");
        await this.avancarPorTimeout(s.id).catch(err => {
          sessionLogger.error({ err, sessionId: s.id }, "erro ao recuperar sessão travada");
        });
      }
    }
  }
}

export const turnoService = new TurnoService();
