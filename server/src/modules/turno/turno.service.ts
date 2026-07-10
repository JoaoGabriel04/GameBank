import { AppError } from "../../middleware/error-handler.middleware.js";
import { withLock } from "../../middleware/lock.middleware.js";
import { turnoRepository } from "./turno.repository.js";
import { sessionLogger } from "../../lib/logger.js";
import { TOTAL_CASAS, POS_PRISAO, CREDITO_INICIO, getCasa, type Casa } from "../tabuleiro/tabuleiro.data.js";
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

    if (primeiro) this.agendarTimeout(sessionId);
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

      if (player.emPrisao) {
        // TODO(Fase 7): tentativas de duplo pra sair da prisão
        throw new AppError(400, "Lógica de prisão ainda não implementada (Fase 7).");
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

      const total = dado1 + dado2;
      const novaPosicao = (player.posicao + total) % TOTAL_CASAS;
      const passouInicio = (player.posicao + total) >= TOTAL_CASAS;
      const saldoAposInicio = passouInicio ? player.saldo + CREDITO_INICIO : player.saldo;

      await turnoRepository.moverPlayer(playerId, {
        posicao: novaPosicao,
        ...(passouInicio ? { saldo: saldoAposInicio } : {}),
      });
      await turnoRepository.registrarDados(sessionId, { ultimoDado1: dado1, ultimoDado2: dado2, aguardandoAcao: true });

      const resolucao = await this.resolverCasa(sessionId, {
        ...player,
        posicao: novaPosicao,
        saldo: saldoAposInicio,
      }, dado1 + dado2);

      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return { dado1, dado2, duplo, foiPreso: false, novaPosicao, passouInicio, ...resolucao };
    });
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
      case 4: return prop.aluguel_4c ?? prop.aluguel_3c ?? prop.aluguel_base ?? 0;
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

      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return resultado;
    });
  }

  async recusarCompra(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      await this.validarPendenciaDeCompra(sessionId, playerId);
      await turnoRepository.setAguardandoAcao(sessionId, false);

      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return { recusado: true };
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
        this.agendarTimeout(sessionId);
        return null;
      }

      return this.avancarTurno(sessionId, session, true);
    });
  }

  private async validarESessaoAtiva(sessionId: number) {
    const session = await turnoRepository.findSessionComJogadores(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");
    if (session.tipoJogo !== "tabuleiro") throw new AppError(400, "Sessão não é do Modo Tabuleiro");
    if (session.status !== "Em Andamento") throw new AppError(400, "Partida não está em andamento");
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

    this.agendarTimeout(sessionId);

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    if (porTimeout) {
      const { emitTurnoTimeout } = await import("../socket/socket.handler.js");
      emitTurnoTimeout(sessionId, { jogadorAnteriorId: session.turnoAtualPlayerId });
    }

    return { turnoAtualPlayerId: proximo.id, avancou: true };
  }

  private agendarTimeout(sessionId: number) {
    cancelTurnoTimer(sessionId);
    const timer = setTimeout(() => {
      this.avancarPorTimeout(sessionId).catch(err => {
        sessionLogger.error({ err, sessionId }, "erro ao avançar turno por timeout");
      });
    }, TURNO_TIMEOUT_MS);
    turnoTimers.set(sessionId, timer);
  }

  cancelarTimeout(sessionId: number) {
    cancelTurnoTimer(sessionId);
  }
}

export const turnoService = new TurnoService();
