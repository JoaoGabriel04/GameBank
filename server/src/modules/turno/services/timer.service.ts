import { withLock } from "../../../middleware/lock.middleware.js";
import { turnoRepository } from "../turno.repository.js";
import { sessionLogger } from "../../../lib/logger.js";
import { MULTA_PRISAO, getCasa } from "../../tabuleiro/tabuleiro.data.js";
import { economiaService } from "./economia.service.js";
import { movimentoService } from "./movimento.service.js";
import { rodadaService } from "./rodada.service.js";

export const TURNO_TIMEOUT_MS = 60_000;

// Timers de turno em memória por sessionId. Como o dado é transitório
// (só importa "há um timer pendente agora") e a app roda como instância
// única no Render, não precisa de Redis — mesmo padrão de fallback em
// memória já usado em socket.ts (activeSockets).
export const turnoTimers = new Map<number, NodeJS.Timeout>();

// Duplos consecutivos do jogador na vez atual — reseta a cada troca de
// turno. Em memória (mesmo racional dos timers): só importa "agora".
export const duplosConsecutivos = new Map<number, number>();

export function cancelTurnoTimer(sessionId: number) {
  const timer = turnoTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    turnoTimers.delete(sessionId);
  }
}

class TimerService {
  // FIX_TURNO_TRAVADO_CONTADOR (BUG C): agendarTimeout NÃO escreve mais
  // turnoIniciadoEm — quem controla o início do turno (ou de uma jogada
  // extra dentro do mesmo turno: duplo, escolha de movimento, tentativa na
  // prisão) grava o timestamp explicitamente e passa aqui por parâmetro.
  // Sem isso, `turnoIniciadoEm` era gravado duas vezes por turno (uma no
  // caller, outra aqui) com timestamps ligeiramente diferentes — o cliente
  // podia ter recebido o primeiro valor via socket antes do segundo write.
  //
  // Vantagem extra: como recebe o timestamp já vigente, agenda pelo tempo
  // RESTANTE (TURNO_TIMEOUT_MS - elapsed) em vez de reiniciar 60s do zero
  // sempre que é chamado sem argumento (ex.: no F5/reconexão via
  // garantirTimerAtivo) — o timer nunca fica maior que o combinado com o
  // cliente.
  async agendarTimeout(sessionId: number, turnoIniciadoEm?: Date) {
    cancelTurnoTimer(sessionId);

    // Sem o timestamp: lê o que já está gravado (não escreve!).
    let inicio = turnoIniciadoEm;
    if (!inicio) {
      const s = await turnoRepository.findSessionComTurno(sessionId);
      if (!s?.turnoIniciadoEm) return;
      inicio = new Date(s.turnoIniciadoEm);
    }

    const esperadoIso = inicio.toISOString();
    const elapsed = Date.now() - inicio.getTime();
    const restante = Math.max(0, TURNO_TIMEOUT_MS - elapsed);

    const timer = setTimeout(async () => {
      try {
        await this.avancarPorTimeout(sessionId, esperadoIso);
      } catch (err: any) {
        if (err?.statusCode === 423) {
          // Lock ocupado — retenta
          this.agendarTimeout(sessionId, inicio);
        } else {
          sessionLogger.error({ err, sessionId }, "erro ao avançar turno por timeout");
        }
      }
    }, restante);
    turnoTimers.set(sessionId, timer);
  }

  cancelarTimeout(sessionId: number) {
    cancelTurnoTimer(sessionId);
  }

  // Disparado pelo timeout de 60s — se o jogador não agiu, o sistema
  // joga automaticamente: rola os dados, move a peça, recusa compras,
  // paga aluguéis/dívidas e avança o turno.
  //
  // BUG 6, Parte C (idempotência): `turnoEsperadoIniciadoEm` é o
  // turnoIniciadoEm que estava vigente quando ESTE timeout foi agendado.
  // Com timer em memória + varredura periódica + re-agendamento no join,
  // mais de um caminho pode tentar avançar o mesmo turno expirado (ex.:
  // o timer perdido dispara tarde, ao mesmo tempo em que a varredura ou
  // um F5 já avançaram). Se o turno já mudou desde o agendamento, este
  // disparo é obsoleto — ignorar em vez de avançar de novo (o que pularia
  // um jogador). Chamadas sem esse parâmetro (varredura, recuperação no
  // boot) não têm essa garantia extra, mas o lock por sessionId já evita
  // execução concorrente entre elas.
  async avancarPorTimeout(sessionId: number, turnoEsperadoIniciadoEm?: string) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await turnoRepository.findSessionComJogadores(sessionId);
      if (!session || session.status !== "Em Andamento" || session.tipoJogo !== "tabuleiro") {
        cancelTurnoTimer(sessionId);
        return null;
      }

      // Leilão em andamento: o turno está pausado de propósito (o timer
      // de turno já foi cancelado em iniciarLeilao). O leilão tem seu
      // próprio timer/varredura — não interferir aqui.
      if (session.emLeilao) {
        cancelTurnoTimer(sessionId);
        return null;
      }

      if (
        turnoEsperadoIniciadoEm &&
        session.turnoIniciadoEm?.toISOString() !== turnoEsperadoIniciadoEm
      ) {
        sessionLogger.info(
          { sessionId, esperado: turnoEsperadoIniciadoEm, atual: session.turnoIniciadoEm },
          "avancarPorTimeout ignorado — turno já avançou por outro caminho"
        );
        return { avancou: false, motivo: "turno já avançou" };
      }

      const { turnoService } = await import("../turno.service.js");

      // Escolha de movimento pendente → tempo esgotado, aplica a SOMA
      // (comportamento clássico). Chama a versão interna (sem lock) —
      // já estamos dentro do withLock deste método, e escolherMovimento
      // público tem o seu próprio (chamá-lo aqui causaria deadlock).
      if (session.aguardandoEscolha && session.turnoAtualPlayerId) {
        sessionLogger.info(
          { sessionId, playerId: session.turnoAtualPlayerId },
          "timeout na escolha de movimento — usando a soma (padrão)"
        );
        const mods = await rodadaService.getModificadores(sessionId);
        return movimentoService.escolherMovimentoInterno(sessionId, session, "soma", mods, true);
      }

      // Ação pendente (compra de propriedade) expirou — o jogador JÁ tinha
      // rolado os dados; só não respondeu ao modal de comprar/recusar.
      // Resolve isso como recusa automática (mesmo caminho de
      // recusarCompra, inclusive leilão) e retorna aqui — NUNCA cai no
      // fallback de "rolar os dados automaticamente" abaixo, que é só
      // para quando o jogador nem chegou a rolar.
      if (session.aguardandoAcao) {
        await turnoRepository.setAguardandoAcao(sessionId, false);

        const atualAcao = session.jogadores.find(j => j.id === session.turnoAtualPlayerId);
        if (!atualAcao || atualAcao.desistiu) {
          return turnoService.avancarTurno(sessionId, session, true);
        }
        const playerAcao = await turnoRepository.findPlayerParaJogada(atualAcao.id);
        if (!playerAcao || playerAcao.sessionId !== sessionId) {
          return turnoService.avancarTurno(sessionId, session, true);
        }

        const casaAcao = getCasa(playerAcao.posicao);
        if (casaAcao.propId == null) {
          return turnoService.avancarTurno(sessionId, session, true);
        }
        // iniciarLeilao pausa o turno (não chama avancarTurno) — a
        // retomada acontece quando o leilão fechar.
        const { leilaoService } = await import("../../leilao/leilao.service.js");
        return leilaoService.iniciarLeilao(sessionId, session, casaAcao.propId);
      }

      const atual = session.jogadores.find(j => j.id === session.turnoAtualPlayerId);
      if (!atual || atual.desistiu) {
        return turnoService.avancarTurno(sessionId, session, true);
      }

      await economiaService.aplicarJurosEmprestimo(sessionId, atual.id);

      // Verifica falência do jogador que perdeu o tempo
      const falencia = await turnoService.verificarFalencia(sessionId, session, { id: atual.id, nome: atual.nome });
      if (falencia) return falencia;

      // Busca dados completos do jogador (posicao, saldo, prisao, etc.)
      const player = await turnoRepository.findPlayerParaJogada(atual.id);
      if (!player || player.sessionId !== sessionId) {
        return turnoService.avancarTurno(sessionId, session, true);
      }

      if (player.emPrisao) {
        // Turno na prisão: decrementa o contador; no último turno paga a multa
        if (player.turnosPrisao > 1) {
          await turnoRepository.moverPlayer(player.id, { turnosPrisao: player.turnosPrisao - 1 });
        } else {
          await economiaService.cobrarComFallbackDivida(
            sessionId, { id: player.id, nome: player.nome, saldo: player.saldo },
            MULTA_PRISAO, null,
            `Multa de R$ ${MULTA_PRISAO} — não conseguiu sair da prisão`
          );
          await turnoRepository.moverPlayer(player.id, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });
        }
      } else {
        // Rola os dados automaticamente
        const dado1 = Math.floor(Math.random() * 6) + 1;
        const dado2 = Math.floor(Math.random() * 6) + 1;
        const total = dado1 + dado2;

        await turnoRepository.registrarDados(sessionId, {
          ultimoDado1: dado1, ultimoDado2: dado2, aguardandoAcao: false,
        });

        // Move e resolve a casa (paga aluguel, sorteia carta, etc.)
        const mods = await rodadaService.getModificadores(sessionId);
        await movimentoService.moverEResolver(sessionId, player, total, mods);
      }

      // Sempre avança o turno no timeout (sem bônus de duplos)
      return turnoService.avancarTurno(sessionId, session, true);
    });
  }

  // BUG 6, Parte B: chamado quando um socket entra na room da sessão (F5,
  // reconexão, novo jogador entrando). Se o processo perdeu o timer em
  // memória (hibernação/restart), este é o caminho mais rápido de
  // recuperação — não precisa esperar a varredura periódica (até 15-17s).
  // Sessões com ação pendente (aguardandoAcao) ficam por conta da
  // varredura periódica, que já cobre esse caso.
  async garantirTimerAtivo(sessionId: number) {
    if (turnoTimers.has(sessionId)) return; // já tem timer rodando

    const session = await turnoRepository.findSessionComJogadores(sessionId);
    if (!session || session.status !== "Em Andamento" || session.tipoJogo !== "tabuleiro") return;
    if (session.emLeilao) return; // turno pausado de propósito — leilão tem timer próprio
    if (!session.turnoIniciadoEm || session.aguardandoAcao) return;

    const elapsed = Date.now() - new Date(session.turnoIniciadoEm).getTime();
    const restante = TURNO_TIMEOUT_MS - elapsed;

    if (restante <= 0) {
      // Já expirou — avançar imediatamente em vez de esperar a varredura
      await this.avancarPorTimeout(sessionId).catch(err => {
        if (err?.statusCode !== 423) {
          sessionLogger.error({ err, sessionId }, "erro ao avançar turno expirado no re-agendamento");
        }
      });
      return;
    }

    // Re-agenda pelo tempo restante, preservando o turnoIniciadoEm atual
    // (não reseta o contador visível ao jogador).
    const esperadoIso = new Date(session.turnoIniciadoEm).toISOString();
    const timer = setTimeout(async () => {
      try {
        await this.avancarPorTimeout(sessionId, esperadoIso);
      } catch (err: any) {
        if (err?.statusCode === 423) {
          this.agendarTimeout(sessionId);
        } else {
          sessionLogger.error({ err, sessionId }, "erro ao avançar turno por timeout (re-agendado)");
        }
      }
    }, restante);
    turnoTimers.set(sessionId, timer);
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

    // Leilão Cego: recuperação imediata no startup (mesma urgência — o
    // timeout do leilão é só 30s, não vale a pena esperar a varredura).
    const { leilaoService } = await import("../../leilao/leilao.service.js");
    await leilaoService.recoverStuckLeiloes();
  }

  // Varredura periódica (BUG 6): os timers de turno vivem em memória do
  // processo — se o servidor hibernar/reiniciar (Render free tier) no meio
  // de uma partida, o setTimeout agendado é perdido e ninguém avança o
  // turno automaticamente. Diferente de recoverStuckSessions (só no boot),
  // esta varredura roda a cada 15s enquanto o processo está de pé, usando
  // turnoIniciadoEm (persistido no banco) como fonte de verdade — nunca
  // depende do timer em memória ter sobrevivido.
  //
  // Margem de +2s sobre o timeout normal: evita competir com o setTimeout
  // in-memory que dispara exatamente em TURNO_TIMEOUT_MS quando ele está
  // saudável (a varredura só deve agir quando o timer normal falhou).
  async varrerTurnosExpirados() {
    const sessions = await turnoRepository.findSessionsStuck();
    const agora = Date.now();

    for (const s of sessions) {
      if (!s.turnoIniciadoEm) continue;
      const elapsed = agora - new Date(s.turnoIniciadoEm).getTime();

      if (elapsed >= TURNO_TIMEOUT_MS + 2000) {
        sessionLogger.warn({ sessionId: s.id, elapsed }, "turno expirado detectado pela varredura periódica");
        await this.avancarPorTimeout(s.id).catch(err => {
          // 423 = lock ocupado (outra ação concorrente já está resolvendo
          // este turno) — não é erro, só significa que já está sendo tratado.
          if (err?.statusCode !== 423) {
            sessionLogger.error({ err, sessionId: s.id }, "erro ao avançar turno na varredura periódica");
          }
        });
      }
    }
  }
}

export const timerService = new TimerService();
