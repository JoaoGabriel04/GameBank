import { AppError } from "../../middleware/error-handler.middleware.js";
import { withLock } from "../../middleware/lock.middleware.js";
import { turnoRepository } from "./turno.repository.js";
import { getCasa } from "../tabuleiro/tabuleiro.data.js";
import { PropriedadeService } from "../propriedade/propriedade.service.js";
import { CartaService } from "../carta/carta.service.js";
import { calcularPatrimonio } from "../../shared/economia-core.js";
import { dadosService } from "./services/dados.service.js";
import { movimentoService } from "./services/movimento.service.js";
import { casaResolverService } from "./services/casa-resolver.service.js";
import { economiaService } from "./services/economia.service.js";
import { rodadaService } from "./services/rodada.service.js";
import { timerService, TURNO_TIMEOUT_MS } from "./services/timer.service.js";

const propriedadeService = new PropriedadeService();
const cartaService = new CartaService();

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

// Orquestrador do turno (Fase 2 da REFORMULACAO_TELA_JOGO): não calcula
// regras de dinheiro/casas/leilão — só valida, adquire o lock de sessão e
// chama os serviços de `./services/` e `../leilao/leilao.service.ts` na
// ordem certa. Os serviços extraídos NÃO chamam withLock — o lock vive
// só aqui (e em leilao.service, com o lock próprio `leilao:${id}`).
class TurnoService {
  // Chamado pelo SessionService.startSession quando tipoJogo === "tabuleiro".
  async iniciarTurnos(sessionId: number, jogadorIds: number[]) {
    const ordem = shuffle(jogadorIds);
    const primeiro = ordem[0] ?? null;
    const agora = new Date();

    await turnoRepository.updateTurno(sessionId, {
      ordemTurnos: JSON.stringify(ordem),
      turnoAtualPlayerId: primeiro,
      turnoIniciadoEm: primeiro ? agora : null,
      aguardandoAcao: false,
    });

    // Semeia o anúncio do primeiro evento — a rodada 1 já nasce como
    // "rodada de aviso" (sem evento ativo, anunciando o que vem na
    // rodada 2). Sem isso, a primeira virada de rodada não teria nada
    // pra promover a eventoAtual (ver rodadaService.processarViradaDeRodada).
    const { sortearEvento } = await import("../../constants/eventos.js");
    await turnoRepository.updateEvento(sessionId, { eventoProximo: sortearEvento().codigo });

    if (primeiro) await timerService.agendarTimeout(sessionId, agora);
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
      // Não pode rolar de novo se já rolou e ainda não escolheu o movimento.
      if (session.aguardandoEscolha) {
        throw new AppError(400, "Escolha o movimento antes de rolar novamente.");
      }

      const player = await turnoRepository.findPlayerParaJogada(playerId);
      if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");
      // Defesa em profundidade: turnoAtualPlayerId pode ficar apontando
      // (temporariamente) pra um jogador que acabou de desistir/ser
      // expulso na própria vez — bloqueia a rolagem mesmo que isso aconteça.
      if (player.desistiu) {
        throw new AppError(403, "Você já saiu desta partida.");
      }

      await economiaService.aplicarJurosEmprestimo(sessionId, player.id);

      const falencia = await this.verificarFalencia(sessionId, session, player);
      if (falencia) return falencia;

      // PRISÃO: fluxo inalterado — não há escolha de movimento na prisão,
      // sempre vale a soma.
      if (player.emPrisao) {
        return casaResolverService.rolarDadosEmPrisao(sessionId, session, player);
      }

      return dadosService.rolar(sessionId, session, player);
    });
  }

  // Público, com lock — chamado pelo jogador via API.
  async escolherMovimento(
    sessionId: number,
    playerId: number,
    escolha: "dado1" | "dado2" | "soma"
  ) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);

      if (session.turnoAtualPlayerId !== playerId) {
        throw new AppError(403, "Não é sua vez de jogar.");
      }

      // Busca os modificadores de evento UMA VEZ e repassa — os serviços
      // extraídos nunca buscam por conta própria (evita import circular
      // entre economia.service e rodada.service).
      const mods = await rodadaService.getModificadores(sessionId);
      return movimentoService.escolherMovimentoInterno(sessionId, session, escolha, mods);
    });
  }

  async revelarDados(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);

      if (session.turnoAtualPlayerId !== playerId) {
        throw new AppError(403, "Não é sua vez de jogar.");
      }
      if (!session.aguardandoEscolha) {
        throw new AppError(400, "Não há dados pendentes para revelar.");
      }
      if (session.ultimoDado1 == null || session.ultimoDado2 == null) {
        throw new AppError(400, "Nenhum dado foi rolado ainda.");
      }

      const player = await turnoRepository.findPlayerParaJogada(playerId);
      if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");
      if (player.desistiu) throw new AppError(403, "Você já saiu desta partida.");

      // Recarrega se a rodada atual já passou do prazo agendado.
      if (player.creditoRecargaEm > 0 && session.rodadaAtual >= player.creditoRecargaEm) {
        await turnoRepository.resetarCreditosVisao(player.id);
        player.creditoVisao = 2;
        player.creditoRecargaEm = 0;
      }

      if (player.creditoVisao <= 0) {
        throw new AppError(400, "Sem créditos de visão disponíveis.");
      }

      // Consome um crédito
      await turnoRepository.usarCreditoVisao(player.id);
      const creditosRestantes = player.creditoVisao - 1;

      // Se acabaram os créditos, agenda recarga para 3 rodadas à frente.
      if (creditosRestantes === 0) {
        await turnoRepository.setCreditoRecargaEm(player.id, session.rodadaAtual + 3);
      }

      // Sem isso, o cache Redis da sessão (session.service.ts, TTL 60s)
      // fica com o creditoVisao pré-consumo: um F5 logo em seguida (ou o
      // próximo "session:updated" recebido por outro jogador) mostra o
      // crédito como se ainda não tivesse sido gasto, mesmo já decrementado
      // no banco — parecia que "usar créditos" simplesmente não funcionava.
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return {
        dado1: session.ultimoDado1,
        dado2: session.ultimoDado2,
        creditosRestantes,
      };
    });
  }

  // Público — chamado por timer.service (falência do jogador que perdeu
  // o timeout).
  async verificarFalencia(
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
    const patrimony = calcularPatrimonio(atual?.saldo ?? 0, posses);

    // ── ANTES da falência limpar as propriedades, executar a garantia ──
    const { EmprestimoService } = await import("../emprestimo/emprestimo.service.js");
    const emprestimoService = new EmprestimoService();
    await emprestimoService.executarGarantia(sessionId, player.id);

    // Falência: propriedades voltam ao banco (sem dono, sem leilão),
    // jogador marcado como falido e removido dos turnos.
    await prisma.$transaction(async (tx) => {
      await tx.sessionPlayer.update({
        where: { id: player.id },
        data: { patrimonyAtDesistir: patrimony },
      });
      // Devolve ao banco tanto as propriedades que o jogador possuía quanto
      // as que ele tinha hipotecado (essas ficam com playerId nulo desde a
      // hipoteca — só rastreadas por lastOwnerId — por isso precisam entrar
      // na busca separadamente, senão continuam hipotecadas indefinidamente
      // presas a um jogador que já saiu da partida).
      await tx.sessionPosses.updateMany({
        where: { sessionId, OR: [{ playerId: player.id }, { lastOwnerId: player.id }] },
        data: { playerId: null, lastOwnerId: null, casas: 0, hipotecada: false, negociando: false },
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

    return {
      falido: true,
      mensagem: `${player.nome} faliu após 3 rodadas sem quitar as dívidas — propriedades voltaram ao banco.`,
      ...avanco,
    };
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

      // Duplo: mesmo jogador joga de novo — nova janela de decisão, novo
      // timestamp (gravado explicitamente; agendarTimeout só lê).
      const agoraDuplo = new Date();
      await turnoRepository.updateTurno(sessionId, { turnoIniciadoEm: agoraDuplo });
      await timerService.agendarTimeout(sessionId, agoraDuplo);
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      return { ...resultado, turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false, duplo: true };
    });
  }

  async recusarCompra(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarPendenciaDeCompra(sessionId, playerId);
      await turnoRepository.setAguardandoAcao(sessionId, false);

      const casa = getCasa(session.posicaoJogador);
      if (casa.propId == null) {
        // Nada a leiloar (não deveria acontecer — validarPendenciaDeCompra
        // já exige aguardandoAcao — mas defensivamente cai no comportamento
        // antigo em vez de travar o turno).
        return this.finalizarRecusaSemLeilao(sessionId, session);
      }

      // Recusar dispara o Leilão Cego — pausa o turno até o leilão fechar.
      const { leilaoService } = await import("../leilao/leilao.service.js");
      return leilaoService.iniciarLeilao(sessionId, session, casa.propId);
    });
  }

  // Público — chamado também por leilao.service quando a propriedade da
  // recusa não existe mais (edge case defensivo).
  async finalizarRecusaSemLeilao(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>
  ) {
    const foiDuplo = session.ultimoDado1 != null && session.ultimoDado1 === session.ultimoDado2;
    if (!foiDuplo) {
      const avanco = await this.avancarTurno(sessionId, session);
      return { recusado: true, ...avanco };
    }

    const agoraDuplo = new Date();
    await turnoRepository.updateTurno(sessionId, { turnoIniciadoEm: agoraDuplo });
    await timerService.agendarTimeout(sessionId, agoraDuplo);
    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);
    return { recusado: true, turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false, duplo: true };
  }

  async usarCartaPrisao(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);
      if (session.turnoAtualPlayerId !== playerId) throw new AppError(403, "Não é sua vez de jogar.");

      const player = await turnoRepository.findPlayerParaJogada(playerId);
      if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");
      if (player.desistiu) throw new AppError(403, "Você já saiu desta partida.");
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
    if (player.desistiu) throw new AppError(403, "Você já saiu desta partida.");

    return { ...session, posicaoJogador: player.posicao };
  }

  private async validarESessaoAtiva(sessionId: number) {
    const session = await turnoRepository.findSessionComJogadores(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");
    if (session.tipoJogo !== "tabuleiro") throw new AppError(400, "Sessão não é do Modo Tabuleiro");
    if (session.status !== "Em Andamento") throw new AppError(400, "Partida não está em andamento");
    // Leilão em andamento: bloqueia qualquer ação de turno (rolar dados,
    // escolher movimento, passar a vez, comprar/recusar). Sem este guard,
    // um cliente poderia chamar essas rotas — protegidas pelo lock
    // `turno:${id}` — enquanto encerrarLeilaoInterno roda sob o lock
    // `leilao:${id}` (namespaces diferentes, sem exclusão mútua entre
    // eles), correndo o risco de avançar o turno duas vezes ou mover o
    // jogador errado.
    if (session.emLeilao) {
      throw new AppError(400, "Há um leilão em andamento — aguarde o resultado.");
    }

    // Fallback: se o timer do servidor não disparou, avança o turno na
    // primeira ação do jogador após o timeout (emLeilao já foi rejeitado
    // acima, então chegar aqui garante que o turno não está pausado).
    if (session.turnoIniciadoEm && !session.aguardandoAcao) {
      const elapsed = Date.now() - new Date(session.turnoIniciadoEm).getTime();
      if (elapsed >= TURNO_TIMEOUT_MS) {
        await this.avancarTurno(sessionId, session, true);
        throw new AppError(400, "Tempo da rodada expirou. Turno avançado automaticamente.");
      }
    }

    return session;
  }

  // Público — chamado pelos serviços extraídos (dados, casa-resolver,
  // movimento, timer, leilao) para retomar/avançar o turno depois de
  // resolver sua parte. Fica no orquestrador porque decide a ordem
  // (rodada, timers, eventos) — não é uma regra de dinheiro isolada.
  async avancarTurno(
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
      const { duplosConsecutivos } = await import("./services/timer.service.js");
      duplosConsecutivos.delete(session.turnoAtualPlayerId);
      propriedadeService.limparConstrucoesTurno(sessionId, session.turnoAtualPlayerId);
    }

    // Ninguém mais ativo para jogar (edge case — o fluxo normal já
    // encerraria a partida antes disso via votação/falência)
    if (!proximo) {
      const { cancelTurnoTimer } = await import("./services/timer.service.js");
      cancelTurnoTimer(sessionId);
      return { turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false };
    }

    // Rodada: incrementa quando o turno passa do último para o primeiro
    // da ordem (detectado pelo índice na ordem ser ≤ que o anterior)
    const proximoIdx = ordem.indexOf(proximo.id);
    if (session.turnoAtualPlayerId != null && proximoIdx <= atualIdx) {
      const novaRodada = session.rodadaAtual + 1;
      await turnoRepository.incrementRodada(sessionId);
      await rodadaService.processarViradaDeRodada(sessionId, novaRodada, session);
    }

    const agora = new Date();
    await turnoRepository.updateTurno(sessionId, {
      turnoAtualPlayerId: proximo.id,
      turnoIniciadoEm: agora,
      aguardandoAcao: false,
    });

    // FIX_TURNO_TRAVADO_CONTADOR (BUG C): passa o timestamp que acabou de
    // ser gravado — agendarTimeout só LÊ, nunca regrava turnoIniciadoEm.
    await timerService.agendarTimeout(sessionId, agora);

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    if (porTimeout) {
      const { emitTurnoTimeout } = await import("../socket/socket.handler.js");
      emitTurnoTimeout(sessionId, { jogadorAnteriorId: session.turnoAtualPlayerId });
    }

    return { turnoAtualPlayerId: proximo.id, avancou: true };
  }

  // ── Pass-throughs para o timer.service — mantêm a API pública estável
  // para os callers externos (index.ts, socket.ts, session.service.ts). ──

  cancelarTimeout(sessionId: number) {
    timerService.cancelarTimeout(sessionId);
  }

  async garantirTimerAtivo(sessionId: number) {
    return timerService.garantirTimerAtivo(sessionId);
  }

  async recoverStuckSessions() {
    return timerService.recoverStuckSessions();
  }

  async varrerTurnosExpirados() {
    return timerService.varrerTurnosExpirados();
  }
}

export const turnoService = new TurnoService();
