import { withLock } from "../../../middleware/lock.middleware.js";
import { mapa2dRepository } from "../mapa2d.repository.js";
import { sessionLogger } from "../../../lib/logger.js";
import { RODADA_DURACAO_MS } from "../../../constants/economiaMapa2D.js";

// Timer resiliente para o fechamento de mês do Mapa 2D — MESMO PADRÃO já
// corrigido no Modo Tabuleiro (turno/services/timer.service.ts, FIX
// FIX_TURNO_TRAVADO_CONTADOR): timestamp persistido no banco
// (Session.fecharMesEm) + setTimeout em memória (best-effort) + varredura
// periódica que recupera fechamentos perdidos por hibernação/restart do
// processo. NUNCA depende só do setTimeout em memória sobreviver.
export const fechamentoTimers = new Map<number, NodeJS.Timeout>();

export function cancelFechamentoTimer(sessionId: number) {
  const timer = fechamentoTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    fechamentoTimers.delete(sessionId);
  }
}

class TimerMapa2DService {
  /** Agenda (ou reagenda) o próximo fechamento — grava fecharMesEm e arma o setTimeout local. */
  async agendarFechamento(sessionId: number, daqui: number = RODADA_DURACAO_MS) {
    cancelFechamentoTimer(sessionId);

    const fecharEm = new Date(Date.now() + daqui);
    await mapa2dRepository.updateSession(sessionId, { fecharMesEm: fecharEm });
    this.armarTimer(sessionId, fecharEm);
  }

  private armarTimer(sessionId: number, fecharEm: Date) {
    cancelFechamentoTimer(sessionId);
    const restante = Math.max(0, fecharEm.getTime() - Date.now());
    const esperadoIso = fecharEm.toISOString();

    const timer = setTimeout(async () => {
      try {
        const { fechamentoMapa2DService } = await import("./fechamento.service.js");
        await fechamentoMapa2DService.fecharMes(sessionId, esperadoIso);
      } catch (err: any) {
        if (err?.statusCode === 423) {
          // Lock ocupado — outra execução já está fechando este mês.
          return;
        }
        sessionLogger.error({ err, sessionId }, "erro ao fechar mês do mapa2d por timeout");
      }
    }, restante);
    fechamentoTimers.set(sessionId, timer);
  }

  /** Reagenda a partir do fecharMesEm já persistido (F5, reconexão, join). */
  async garantirTimerAtivo(sessionId: number) {
    if (fechamentoTimers.has(sessionId)) return;

    const session = await mapa2dRepository.findSessionAtiva(sessionId);
    if (!session?.fecharMesEm) return;

    this.armarTimer(sessionId, new Date(session.fecharMesEm));
  }

  /** Recuperação no boot — sessões cujo fechamento já expirou enquanto o processo estava fora do ar. */
  async recoverStuckSessions() {
    const sessions = await mapa2dRepository.findSessoesMapa2DComFechamentoPendente();
    const now = Date.now();
    for (const s of sessions) {
      if (!s.fecharMesEm) continue;
      if (new Date(s.fecharMesEm).getTime() <= now) {
        sessionLogger.warn({ sessionId: s.id }, "recuperando fechamento de mês travado do mapa2d no startup");
        const { fechamentoMapa2DService } = await import("./fechamento.service.js");
        await fechamentoMapa2DService.fecharMes(s.id).catch((err) => {
          sessionLogger.error({ err, sessionId: s.id }, "erro ao recuperar fechamento de mês travado");
        });
      } else {
        this.armarTimer(s.id, new Date(s.fecharMesEm));
      }
    }
  }

  /** Varredura periódica — mesmo racional do BUG 6 do Modo Tabuleiro. */
  async varrerFechamentosExpirados() {
    const sessions = await mapa2dRepository.findSessoesMapa2DComFechamentoPendente();
    const agora = Date.now();

    for (const s of sessions) {
      if (!s.fecharMesEm) continue;
      const elapsed = agora - new Date(s.fecharMesEm).getTime();

      if (elapsed >= 2000) {
        sessionLogger.warn({ sessionId: s.id, elapsed }, "fechamento de mês do mapa2d expirado detectado pela varredura");
        const { fechamentoMapa2DService } = await import("./fechamento.service.js");
        await fechamentoMapa2DService.fecharMes(s.id).catch((err) => {
          if (err?.statusCode !== 423) {
            sessionLogger.error({ err, sessionId: s.id }, "erro ao fechar mês do mapa2d na varredura periódica");
          }
        });
      }
    }
  }
}

export const timerMapa2DService = new TimerMapa2DService();
