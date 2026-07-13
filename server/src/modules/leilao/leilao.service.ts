import { AppError } from "../../middleware/error-handler.middleware.js";
import { withLock } from "../../middleware/lock.middleware.js";
import { sessionLogger } from "../../lib/logger.js";
import { turnoRepository } from "../turno/turno.repository.js";
import { PropriedadeRepository } from "../propriedade/propriedade.repository.js";
import { PropriedadeService } from "../propriedade/propriedade.service.js";
import { LEILAO_LANCE_MINIMO_PCT, LEILAO_TIMEOUT_MS } from "../../constants/economia.js";
import { calcularPatrimonio } from "../../shared/economia-core.js";
import { leilaoRepository } from "./leilao.repository.js";

const propriedadeRepository = new PropriedadeRepository();
const propriedadeService = new PropriedadeService();

// Timer do leilão — em memória, por isso a varredura periódica de
// varrerLeiloesExpirados é obrigatória: sem ela, um leilão perdido por
// hibernação/restart trava a partida inteira, já que o turno não avança
// enquanto emLeilao for true.
const leilaoTimers = new Map<number, NodeJS.Timeout>();

function cancelLeilaoTimer(sessionId: number) {
  const timer = leilaoTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    leilaoTimers.delete(sessionId);
  }
}

class LeilaoService {
  // ═══════════════════ Leilão Cego (Mecânica 4) ═══════════════════════
  //
  // Lock PRÓPRIO (`leilao:${id}`) — NUNCA aninhado com `turno:${id}`.
  // iniciarLeilao/encerrarLeilaoInterno rodam dentro do lock de turno
  // (herdado de recusarCompra/avancarPorTimeout, no orquestrador/timer);
  // darLance e encerrarLeilaoPorTimeout rodam dentro do lock de leilão. Os
  // dois nunca se chamam um ao outro dentro do lock errado — deadlock
  // evitado por construção.

  // Abre o leilão para todos os jogadores ativos. PAUSA o turno — o timer
  // de turno é cancelado e só retoma quando o leilão fechar
  // (encerrarLeilaoInterno). Chamado de dentro do lock de turno (herdado
  // do orquestrador/timer.service) — nunca adquire o lock de leilão.
  async iniciarLeilao(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    propId: number
  ) {
    const posse = await propriedadeRepository.findSessionPosses(sessionId, propId);
    if (!posse?.propriedade) {
      const { turnoService } = await import("../turno/turno.service.js");
      return turnoService.finalizarRecusaSemLeilao(sessionId, session);
    }

    const lanceMinimo = Math.round(posse.propriedade.custo_compra * LEILAO_LANCE_MINIMO_PCT);

    // Pausa o timer do turno — o leilão tem timer próprio (30s).
    const { cancelTurnoTimer } = await import("../turno/services/timer.service.js");
    cancelTurnoTimer(sessionId);

    await turnoRepository.updateLeilao(sessionId, {
      emLeilao: true,
      leilaoPropId: propId,
      leilaoIniciadoEm: new Date(),
      leilaoLanceMinimo: lanceMinimo,
    });

    // Limpa lances antigos desta propriedade (segurança — ex.: um leilão
    // anterior para a mesma prop que não tenha limpado corretamente).
    await leilaoRepository.limparLances(sessionId, propId);

    // Agenda o encerramento em 30s (timer resiliente — ver agendarTimeoutLeilao)
    await this.agendarTimeoutLeilao(sessionId);

    const { emitToRoom } = await import("../../lib/socket.js");
    emitToRoom(sessionId, "leilao:iniciado", {
      propId,
      nome: posse.propriedade.nome,
      precoTabela: posse.propriedade.custo_compra,
      lanceMinimo,
      timeoutMs: LEILAO_TIMEOUT_MS,
    });

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return { recusado: true, leilaoIniciado: true, propId, lanceMinimo };
  }

  async darLance(sessionId: number, playerId: number, valor: number) {
    return withLock(`leilao:${sessionId}`, async () => {
      const session = await turnoRepository.findSessionComJogadores(sessionId);
      if (!session?.emLeilao || session.leilaoPropId == null) {
        throw new AppError(400, "Não há leilão em andamento.");
      }

      const player = await turnoRepository.findPlayerParaJogada(playerId);
      if (!player || player.sessionId !== sessionId || player.desistiu) {
        throw new AppError(403, "Você não participa desta sessão.");
      }

      // Lance é VINCULANTE — não pode mudar de ideia depois de dar.
      const existente = await leilaoRepository.findLance(sessionId, session.leilaoPropId, playerId);
      if (existente) throw new AppError(400, "Você já deu seu lance neste leilão.");

      // valor 0 = passou (não quer participar)
      if (valor > 0) {
        const minimo = session.leilaoLanceMinimo ?? 0;
        if (valor < minimo) {
          throw new AppError(400, `O lance mínimo é R$ ${minimo}.`);
        }
        if (valor > player.saldo) {
          throw new AppError(400, "Você não tem saldo suficiente para esse lance.");
        }
      }

      await leilaoRepository.criarLance({
        sessionId, propId: session.leilaoPropId, playerId, valor,
      });

      // SIGILO: nunca inclui o valor — só avisa que o jogador decidiu.
      const { emitToRoom } = await import("../../lib/socket.js");
      emitToRoom(sessionId, "leilao:jogador_decidiu", { playerId });

      // Se todos os jogadores ativos já deram lance, encerra antes do timeout.
      const ativos = await leilaoRepository.contarJogadoresAtivos(sessionId);
      const lances = await leilaoRepository.contarLances(sessionId, session.leilaoPropId);

      if (lances >= ativos) {
        return this.encerrarLeilaoInterno(sessionId, session);
      }

      return { lanceRegistrado: true };
    });
  }

  // Chamado de dentro do lock de leilão (darLance, encerrarLeilaoPorTimeout).
  // Nunca adquire o lock de turno.
  private async encerrarLeilaoInterno(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>
  ) {
    const propId = session.leilaoPropId;
    if (propId == null) return null;

    cancelLeilaoTimer(sessionId);

    const lances = await leilaoRepository.findLances(sessionId, propId);
    const validos = lances.filter(l => l.valor > 0);

    let vencedor: { playerId: number; valor: number } | null = null;

    if (validos.length > 0) {
      const maiorValor = Math.max(...validos.map(l => l.valor));
      const empatados = validos.filter(l => l.valor === maiorValor);

      if (empatados.length === 1) {
        vencedor = { playerId: empatados[0].playerId, valor: maiorValor };
      } else {
        // ── DESEMPATE: menor patrimônio leva (mecânica de catch-up) ──
        const patrimonios = await Promise.all(
          empatados.map(async l => ({
            playerId: l.playerId,
            patrimonio: await this.calcularPatrimonioDoJogador(l.playerId),
          }))
        );
        patrimonios.sort((a, b) => a.patrimonio - b.patrimonio);
        vencedor = { playerId: patrimonios[0].playerId, valor: maiorValor };
      }
    }

    if (vencedor) {
      // Lance VINCULANTE: o vencedor é obrigado a comprar, pelo valor do
      // lance (não o de tabela).
      await propriedadeService.buyPropPorValor(propId, sessionId, vencedor.playerId, vencedor.valor);

      await turnoRepository.criarHistorico({
        sessionId,
        tipo: "LEILAO",
        detalhes: `Leilão encerrado: propriedade arrematada por R$ ${vencedor.valor}`,
      });
    } else {
      await turnoRepository.criarHistorico({
        sessionId,
        tipo: "LEILAO",
        detalhes: `Leilão encerrado sem lances — propriedade segue sem dono.`,
      });
    }

    // Limpa o estado de leilão
    await turnoRepository.updateLeilao(sessionId, {
      emLeilao: false,
      leilaoPropId: null,
      leilaoIniciadoEm: null,
      leilaoLanceMinimo: null,
    });
    await leilaoRepository.limparLances(sessionId, propId);

    // Revela TODOS os lances (agora sim — momento de tensão do leilão cego)
    const { emitToRoom } = await import("../../lib/socket.js");
    emitToRoom(sessionId, "leilao:resultado", {
      propId,
      lances: lances.map(l => ({ playerId: l.playerId, valor: l.valor })),
      vencedorId: vencedor?.playerId ?? null,
      valorFinal: vencedor?.valor ?? null,
    });

    // ── RETOMAR O TURNO ──────────────────────────────────────────────
    // O jogador que recusou continua na vez (a menos que tenha tirado
    // duplo, caso em que joga de novo; senão o turno avança).
    const foiDuplo = session.ultimoDado1 != null && session.ultimoDado1 === session.ultimoDado2;
    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    const { turnoService } = await import("../turno/turno.service.js");

    if (!foiDuplo) {
      const sessionAtual = await turnoRepository.findSessionComJogadores(sessionId);
      const avanco = await turnoService.avancarTurno(sessionId, sessionAtual!);
      await emitUpdatedSession(sessionId);
      return { leilaoEncerrado: true, vencedor, ...avanco };
    }

    // Duplo: o mesmo jogador joga de novo — reagenda o timer do turno com
    // um novo timestamp explícito (agendarTimeout só lê, nunca regrava).
    const agoraDuplo = new Date();
    await turnoRepository.updateTurno(sessionId, { turnoIniciadoEm: agoraDuplo });
    const { timerService } = await import("../turno/services/timer.service.js");
    await timerService.agendarTimeout(sessionId, agoraDuplo);
    await emitUpdatedSession(sessionId);
    return { leilaoEncerrado: true, vencedor, avancou: false, duplo: true };
  }

  // Reutiliza o mesmo cálculo usado na falência (saldo + custo_compra das
  // propriedades + casas × custo_casa) — aqui para o desempate do leilão.
  private async calcularPatrimonioDoJogador(playerId: number): Promise<number> {
    const { prisma } = await import("../../lib/prisma.js");
    const player = await prisma.sessionPlayer.findUnique({ where: { id: playerId }, select: { saldo: true } });
    const posses = await prisma.sessionPosses.findMany({
      where: { playerId },
      include: { propriedade: true },
    });
    return calcularPatrimonio(player?.saldo ?? 0, posses);
  }

  private async agendarTimeoutLeilao(sessionId: number) {
    cancelLeilaoTimer(sessionId);
    const timer = setTimeout(() => {
      this.encerrarLeilaoPorTimeout(sessionId).catch(err => {
        sessionLogger.error({ err, sessionId }, "erro ao encerrar leilão por timeout");
      });
    }, LEILAO_TIMEOUT_MS);
    leilaoTimers.set(sessionId, timer);
  }

  // Ponto de entrada do timeout — adquire o lock de LEILÃO (nunca o de
  // turno). Quem não deu lance a tempo conta implicitamente como "passou"
  // (não há registro — encerrarLeilaoInterno só considera quem deu lance).
  async encerrarLeilaoPorTimeout(sessionId: number) {
    return withLock(`leilao:${sessionId}`, async () => {
      const session = await turnoRepository.findSessionComJogadores(sessionId);
      if (!session?.emLeilao) return null; // já encerrado por outro caminho
      return this.encerrarLeilaoInterno(sessionId, session);
    });
  }

  // Varredura periódica (mesmo padrão do BUG 6 / varrerTurnosExpirados):
  // sem isso, um leilão cujo timer em memória se perdeu (hibernação/
  // restart do processo) trava a partida inteira, já que o turno não
  // avança enquanto emLeilao for true. Chamada no mesmo intervalo de 15s.
  async varrerLeiloesExpirados() {
    const sessions = await turnoRepository.findSessionsEmLeilao();
    const agora = Date.now();

    for (const s of sessions) {
      if (!s.leilaoIniciadoEm) continue;
      const elapsed = agora - new Date(s.leilaoIniciadoEm).getTime();

      if (elapsed >= LEILAO_TIMEOUT_MS + 2000) {
        sessionLogger.warn({ sessionId: s.id, elapsed }, "leilão expirado detectado pela varredura periódica");
        await this.encerrarLeilaoPorTimeout(s.id).catch(err => {
          if (err?.statusCode !== 423) {
            sessionLogger.error({ err, sessionId: s.id }, "erro ao encerrar leilão na varredura periódica");
          }
        });
      }
    }
  }

  // Recuperação imediata no startup (a periódica de 15s já cobre isso, mas
  // o timeout do leilão é só 30s — vale a pena não esperar o primeiro
  // ciclo da varredura). Chamado por timer.service.recoverStuckSessions.
  async recoverStuckLeiloes() {
    const emLeilao = await turnoRepository.findSessionsEmLeilao();
    const now = Date.now();
    for (const s of emLeilao) {
      if (!s.leilaoIniciadoEm) continue;
      const elapsed = now - new Date(s.leilaoIniciadoEm).getTime();
      if (elapsed >= LEILAO_TIMEOUT_MS) {
        sessionLogger.warn({ sessionId: s.id, elapsed }, "recuperando leilão travado no startup");
        await this.encerrarLeilaoPorTimeout(s.id).catch(err => {
          sessionLogger.error({ err, sessionId: s.id }, "erro ao recuperar leilão travado");
        });
      }
    }
  }
}

export const leilaoService = new LeilaoService();
