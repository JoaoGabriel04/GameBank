import { HistoricoRepository } from "./historico.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";

export class HistoricoService {
  constructor(private repo = new HistoricoRepository()) {}

  async listBySession(sessionId: number) {
    const historico = await this.repo.findBySessionId(sessionId);
    if (!historico || historico.length === 0) {
      throw new AppError(404, "Nenhum histórico encontrado para esta sessão");
    }
    return historico;
  }
}
