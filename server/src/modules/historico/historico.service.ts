import { HistoricoRepository } from "./historico.repository.js";

export class HistoricoService {
  constructor(private repo = new HistoricoRepository()) {}

  // Página do histórico completo (aba Histórico). O payload da sessão só
  // leva as últimas entradas; o resto vem daqui, sob demanda.
  async listarPagina(sessionId: number, limite: number, antesDeId?: number) {
    const linhas = await this.repo.findBySessionId(sessionId, limite + 1, antesDeId);
    const itens = linhas.slice(0, limite);
    return {
      itens,
      proximoCursor: linhas.length > limite ? itens[itens.length - 1].id : null,
    };
  }
}
