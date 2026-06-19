import { z } from "zod";
import type { Request, Response } from "express";
import { NegociacaoService } from "./negociacao.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitUpdatedSession } from "../socket/socket.handler.js";
import { emitToRoom, emitToUserWithRetry } from "../../lib/socket.js";
import { logger } from "../../lib/logger.js";

const negociacaoService = new NegociacaoService();

const NegItemSchema = z.object({
  sessionPossesId: z.number().int().positive().nullable().optional(),
  fromSide: z.boolean(),
  valor: z.number().min(0).nullable().optional(),
});

const CriarSchema = z.object({
  sessionId: z.number().int().positive(),
  fromPlayerId: z.number().int().positive(),
  toPlayerId: z.number().int().positive(),
  offerItems: z.array(NegItemSchema).default([]),
  wantItems: z.array(NegItemSchema).default([]),
});

const PlayerIdBodySchema = z.object({
  playerId: z.number().int().positive(),
});

const ContraOfertarSchema = z.object({
  playerId: z.number().int().positive(),
  offerItems: z.array(NegItemSchema).default([]),
  wantItems: z.array(NegItemSchema).default([]),
});

function parseError(res: Response, err: unknown) {
  if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
  if (err instanceof z.ZodError) return res.status(400).json({ message: "Dados inválidos", details: err.flatten().fieldErrors });
  logger.error({ err });
  return res.status(500).json({ message: "Erro interno." });
}

export const negociacaoController = {
  criar: async (req: Request, res: Response) => {
    try {
      const body = CriarSchema.parse(req.body);
      const negotiation = await negociacaoService.criarNegociacao(
        body.sessionId,
        body.fromPlayerId,
        body.toPlayerId,
        body.offerItems,
        body.wantItems
      );
      // Broadcast na sala é mais confiável que emitToUserWithRetry individual
      // O cliente filtra por targetUserId no payload
      const toUserId = negotiation?.toPlayer?.userId;
      emitToRoom(body.sessionId, "negotiation:toast", {
        type: "new",
        targetUserId: toUserId,
        negotiation,
      });
      emitUpdatedSession(body.sessionId).catch(() => {});
      return res.status(201).json(negotiation);
    } catch (err) {
      return parseError(res, err);
    }
  },

  aceitar: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { playerId } = PlayerIdBodySchema.parse(req.body);
      const negotiation = await negociacaoService.aceitarNegociacao(id, playerId);
      if (!negotiation) throw new AppError(404, "Negociação não encontrada após aceitar");
      const fromUserId = negotiation.fromPlayer?.userId;
      const toUserId   = negotiation.toPlayer?.userId;
      // Broadcast na sala — mais confiável que emitToUserWithRetry
      emitToRoom(negotiation.sessionId, "negotiation:toast", {
        type: "accepted",
        role: "proposer",
        targetUserId: fromUserId,
        negotiation,
      });
      emitToRoom(negotiation.sessionId, "negotiation:toast", {
        type: "accepted",
        role: "target",
        targetUserId: toUserId,
        negotiation,
      });
      emitUpdatedSession(negotiation.sessionId).catch(() => {});
      return res.status(200).json(negotiation);
    } catch (err) {
      return parseError(res, err);
    }
  },

  recusar: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { playerId } = PlayerIdBodySchema.parse(req.body);
      const negotiation = await negociacaoService.recusarNegociacao(id, playerId);
      if (!negotiation) throw new AppError(404, "Negociação não encontrada após recusar");
      const fromUserId = negotiation.fromPlayer?.userId;
      // Broadcast na sala — mais confiável que emitToUserWithRetry
      emitToRoom(negotiation.sessionId, "negotiation:toast", {
        type: "rejected",
        targetUserId: fromUserId,
        negotiationId: negotiation.id,
      });
      emitUpdatedSession(negotiation.sessionId).catch(() => {});
      return res.status(200).json(negotiation);
    } catch (err) {
      return parseError(res, err);
    }
  },

  contraOfertar: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = ContraOfertarSchema.parse(req.body);
      const newNegotiation = await negociacaoService.contraOfertar(
        id,
        body.playerId,
        body.offerItems,
        body.wantItems
      );
      if (!newNegotiation) throw new AppError(404, "Negociação não encontrada após contra-oferta");
      const toUserId = newNegotiation.toPlayer?.userId;
      // Broadcast na sala — mais confiável que emitToUserWithRetry
      emitToRoom(newNegotiation.sessionId, "negotiation:toast", {
        type: "counter",
        targetUserId: toUserId,
        negotiation: newNegotiation,
      });
      emitUpdatedSession(newNegotiation.sessionId).catch(() => {});
      return res.status(201).json(newNegotiation);
    } catch (err) {
      return parseError(res, err);
    }
  },

  pendentes: async (req: Request, res: Response) => {
    try {
      const playerId = z.coerce.number().int().positive().parse(req.params.playerId);
      const sessionId = z.coerce.number().int().positive().parse(req.query.sessionId);
      const negotiations = await negociacaoService.listarPendentes(sessionId, playerId);
      return res.status(200).json(negotiations);
    } catch (err) {
      return parseError(res, err);
    }
  },
};

