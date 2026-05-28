import type { Request, Response } from "express";
import { NegociacaoService } from "./negociacao.service.js";
import { SessionService } from "../session/session.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitSessionUpdated } from "../socket/socket.handler.js";
import { emitToPlayer } from "../../lib/socket.js";

const negociacaoService = new NegociacaoService();
const sessionService = new SessionService();

async function emitUpdatedSession(sessionId: number) {
  await sessionService.invalidateCache(sessionId);
  const session = await sessionService.loadSession(sessionId);
  emitSessionUpdated(sessionId, session);
}

export const negociacaoController = {
  criar: async (req: Request, res: Response) => {
    const { sessionId, fromPlayerId, toPlayerId, offerItems, wantItems } = req.body;
    if (!sessionId || !fromPlayerId || !toPlayerId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const negotiation = await negociacaoService.criarNegociacao(
        Number(sessionId),
        Number(fromPlayerId),
        Number(toPlayerId),
        offerItems || [],
        wantItems || []
      );

      emitToPlayer(Number(sessionId), Number(toPlayerId), "negotiation:new", negotiation);

      await emitUpdatedSession(Number(sessionId));
      return res.status(201).json(negotiation);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao criar negociação!", err);
      return res.status(500).json({ message: "Erro interno ao criar negociação." });
    }
  },

  aceitar: async (req: Request, res: Response) => {
    const { id } = req.params;
    const { playerId } = req.body;
    if (!id || !playerId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const negotiation = await negociacaoService.aceitarNegociacao(
        Number(id),
        Number(playerId)
      );

      if (!negotiation) throw new AppError(404, "Negociação não encontrada após aceitar");

      emitToPlayer(negotiation.sessionId, negotiation.fromPlayerId, "negotiation:accepted", negotiation);
      emitToPlayer(negotiation.sessionId, negotiation.toPlayerId, "negotiation:accepted", negotiation);

      await emitUpdatedSession(negotiation.sessionId);
      return res.status(200).json(negotiation);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao aceitar negociação!", err);
      return res.status(500).json({ message: "Erro interno ao aceitar negociação." });
    }
  },

  recusar: async (req: Request, res: Response) => {
    const { id } = req.params;
    const { playerId } = req.body;
    if (!id || !playerId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const negotiation = await negociacaoService.recusarNegociacao(
        Number(id),
        Number(playerId)
      );

      if (!negotiation) throw new AppError(404, "Negociação não encontrada após recusar");

      emitToPlayer(negotiation.sessionId, negotiation.fromPlayerId, "negotiation:rejected", {
        negotiationId: negotiation.id,
      });

      await emitUpdatedSession(negotiation.sessionId);
      return res.status(200).json(negotiation);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao recusar negociação!", err);
      return res.status(500).json({ message: "Erro interno ao recusar negociação." });
    }
  },

  contraOfertar: async (req: Request, res: Response) => {
    const { id } = req.params;
    const { playerId, offerItems, wantItems } = req.body;
    if (!id || !playerId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const newNegotiation = await negociacaoService.contraOfertar(
        Number(id),
        Number(playerId),
        offerItems || [],
        wantItems || []
      );

      if (!newNegotiation) throw new AppError(404, "Negociação não encontrada após contra-oferta");

      emitToPlayer(
        newNegotiation.sessionId,
        newNegotiation.toPlayerId,
        "negotiation:counter",
        newNegotiation
      );

      await emitUpdatedSession(newNegotiation.sessionId);
      return res.status(201).json(newNegotiation);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao contra-ofertar!", err);
      return res.status(500).json({ message: "Erro interno ao contra-ofertar." });
    }
  },

  pendentes: async (req: Request, res: Response) => {
    const { playerId } = req.params;
    const sessionId = req.query.sessionId;
    if (!playerId || !sessionId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const negotiations = await negociacaoService.listarPendentes(
        Number(sessionId),
        Number(playerId)
      );
      return res.status(200).json(negotiations);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao listar pendentes!", err);
      return res.status(500).json({ message: "Erro interno ao listar pendentes." });
    }
  },
};

export default negociacaoController;
