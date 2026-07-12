import { turnoRepository } from "../turno.repository.js";
import { getEvento, sortearEvento, EVENTO_DURACAO_RODADAS, type EventoEfeito } from "../../../constants/eventos.js";

class RodadaService {
  // Busca os multiplicadores do evento econômico ativo na sessão (evento
  // nenhum → objeto vazio, todos os multiplicadores tratados como 1/0
  // pelos callers). Público — o orquestrador busca uma vez por operação e
  // repassa como parâmetro para os demais serviços (evita cada serviço
  // buscar por conta própria e criar imports circulares).
  async getModificadores(sessionId: number): Promise<EventoEfeito> {
    const session = await turnoRepository.findEventoAtual(sessionId);
    return getEvento(session?.eventoAtual)?.efeito ?? {};
  }

  // Processa a virada de rodada: ciclo de 3 rodadas — 1 de aviso (sem
  // evento ativo, eventoProximo anunciado) + EVENTO_DURACAO_RODADAS (2)
  // rodadas com o evento ativo. Máquina de estados baseada em
  // eventoRodadasRestantes (quantas rodadas o eventoAtual ainda dura),
  // não em aritmética sobre o número da rodada — assim o evento pode
  // durar mais de 1 rodada sem precisar recalcular a partir de rodadaAtual.
  async processarViradaDeRodada(
    sessionId: number,
    novaRodada: number,
    session: { eventoAtual?: string | null; eventoProximo?: string | null; eventoRodadasRestantes?: number | null }
  ) {
    const restantes = session.eventoRodadasRestantes ?? 0;

    let eventoAtivo: string | null;
    let novasRestantes: number;
    let eventoProximo: string | null;
    let eventoRecemAtivado = false;
    // Continuação pura (evento já ativo, só decrementando) não muda nada
    // que o cliente precise saber além do que a sessão já carrega — sem
    // este flag, o modal de ativação reapareceria a cada rodada em que o
    // evento (agora com 2 rodadas de duração) segue ativo.
    let houveTransicao = true;

    if (session.eventoAtual && restantes > 1) {
      // Evento em curso, ainda tem rodada(s) sobrando — continua igual.
      eventoAtivo = session.eventoAtual;
      novasRestantes = restantes - 1;
      eventoProximo = null;
      houveTransicao = false;
    } else if (session.eventoAtual) {
      // Evento acabou de esgotar as rodadas — esta é a rodada de aviso:
      // sem evento ativo, sorteia e anuncia o próximo.
      eventoAtivo = null;
      novasRestantes = 0;
      eventoProximo = sortearEvento(session.eventoAtual).codigo;
    } else if (session.eventoProximo) {
      // Estávamos na rodada de aviso — o evento anunciado agora começa.
      eventoAtivo = session.eventoProximo;
      novasRestantes = EVENTO_DURACAO_RODADAS;
      eventoProximo = null;
      eventoRecemAtivado = true;
    } else {
      // Sem evento e sem aviso pendente (não deveria acontecer após o
      // bootstrap em iniciarTurnos, mas não deixa a sessão travada).
      eventoAtivo = null;
      novasRestantes = 0;
      eventoProximo = null;
    }

    await turnoRepository.updateEvento(sessionId, {
      eventoAtual: eventoAtivo,
      eventoProximo,
      eventoRodadasRestantes: novasRestantes,
    });

    const def = getEvento(eventoAtivo);
    if (eventoRecemAtivado && def?.efeito.creditoImediato) {
      await turnoRepository.creditarTodosAtivos(sessionId, def.efeito.creditoImediato);
    }

    if (eventoRecemAtivado) {
      await turnoRepository.criarHistorico({
        sessionId,
        tipo: "EVENTO_ECONOMICO",
        detalhes: `Rodada ${novaRodada}: ${def?.nome} — ${def?.descricao}`,
      });
    }

    // Só notifica em transições reais (evento ativou ou virou aviso) —
    // continuação pura não emite, pra não reabrir o modal de ativação
    // a cada rodada em que o mesmo evento segue valendo.
    if (houveTransicao) {
      const { emitToRoom } = await import("../../../lib/socket.js");
      emitToRoom(sessionId, "evento:mudou", {
        rodada: novaRodada,
        eventoAtual: eventoAtivo,
        eventoProximo,
      });
    }
  }
}

export const rodadaService = new RodadaService();
