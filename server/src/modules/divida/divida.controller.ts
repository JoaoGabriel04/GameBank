import type { Request, Response } from "express";
import { DividaService } from "./divida.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { SessionService } from "../session/session.service.js";
import { emitSessionUpdated } from "../socket/socket.handler.js";

const dividaService = new DividaService();
const sessionService = new SessionService();

async function emitUpdatedSession(sessionId: number) {
  await sessionService.invalidateCache(sessionId);
  const session = await sessionService.loadSession(sessionId);
  emitSessionUpdated(sessionId, session);
}

export const dividaController = {
  listarPendentes: async (req: Request, res: Response) => {
    try {
      const { sessionId, playerId } = req.params;
      const dividas = await dividaService.listarPendentes(
        Number(sessionId),
        Number(playerId)
      );
      return res.status(200).json(dividas);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao listar dívidas!", err);
      return res.status(500).json({ message: "Erro interno ao listar dívidas." });
    }
  },

  pagarDivida: async (req: Request, res: Response) => {
    try {
      const { debtId } = req.params;
      const { playerId, sessionId } = req.body;
      const result = await dividaService.pagarDivida(Number(debtId), Number(playerId));
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao pagar dívida!", err);
      return res.status(500).json({ message: "Erro interno ao pagar dívida." });
    }
  },
};

export default dividaController;
