import { z } from "zod";
import type { Request, Response } from "express";
import { NegociacaoService } from "./negociacao.service.js";
import { SessionService } from "../session/session.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitSessionUpdated } from "../socket/socket.handler.js";
import { emitToUser, emitToUserWithRetry } from "../../lib/socket.js";

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
      // Emite notificação com retry — tenta 2 vezes com 50ms entre tentativas.
      // Se falhar, emitSessionUpdated (broadcast) vai sincronizar estado.
      const toUserId = negotiation?.toPlayer?.userId;
      if (toUserId) {
        const delivered = await emitToUserWithRetry(toUserId, "negotiation:new", negotiation);
        if (!delivered) {
          console.error(`[Negociação] Falha ao entregar notificação para usuário ${toUserId}, confiando em broadcast`);
        }
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
      const fromUserId = negotiation.fromPlayer?.userId;
      const toUserId   = negotiation.toPlayer?.userId;
      // Tenta entregar com retry para ambos os jogadores
      if (fromUserId) {
        const delivered = await emitToUserWithRetry(fromUserId, "negotiation:accepted", negotiation);
        if (!delivered) console.error(`[Negociação] Falha ao notificar aceitação para usuário ${fromUserId}`);
      }
      if (toUserId) {
        const delivered = await emitToUserWithRetry(toUserId, "negotiation:accepted", negotiation);
        if (!delivered) console.error(`[Negociação] Falha ao notificar aceitação para usuário ${toUserId}`);
      }
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
      const fromUserId = negotiation.fromPlayer?.userId;
      if (fromUserId) {
        const delivered = await emitToUserWithRetry(fromUserId, "negotiation:rejected", { negotiationId: negotiation.id });
        if (!delivered) console.error(`[Negociação] Falha ao notificar recusa para usuário ${fromUserId}`);
      }
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
      const toUserId = newNegotiation.toPlayer?.userId;
      if (toUserId) {
        const delivered = await emitToUserWithRetry(toUserId, "negotiation:counter", newNegotiation);
        if (!delivered) {
          console.error(`[Negociação] Falha ao entregar contra-oferta para usuário ${toUserId}`);
        }
      }
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
