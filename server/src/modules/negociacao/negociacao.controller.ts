import { z } from "zod";
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
  console.error(err);
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
      if (negotiation?.toPlayerId) {
        emitToPlayer(body.sessionId, negotiation.toPlayerId, "negotiation:new", negotiation);
      }
      await emitUpdatedSession(body.sessionId);
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
      emitToPlayer(negotiation.sessionId, negotiation.fromPlayerId, "negotiation:accepted", negotiation);
      emitToPlayer(negotiation.sessionId, negotiation.toPlayerId,   "negotiation:accepted", negotiation);
      await emitUpdatedSession(negotiation.sessionId);
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
      emitToPlayer(negotiation.sessionId, negotiation.fromPlayerId, "negotiation:rejected", { negotiationId: negotiation.id });
      await emitUpdatedSession(negotiation.sessionId);
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
      emitToPlayer(newNegotiation.sessionId, newNegotiation.toPlayerId, "negotiation:counter", newNegotiation);
      await emitUpdatedSession(newNegotiation.sessionId);
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

export default negociacaoController;
