import { z } from "zod";
import type { Request, Response } from "express";
import { PropriedadeService } from "./propriedade.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitNotificationNew, emitUpdatedSession } from "../socket/socket.handler.js";
import { logger } from "../../lib/logger.js";

const propriedadeService = new PropriedadeService();

const SessionPlayerBody = z.object({
  sessionId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

const PropBody = SessionPlayerBody.extend({
  propriedadeId: z.coerce.number().int().positive(),
});

function parseError(res: Response, err: unknown) {
  if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
  if (err instanceof z.ZodError) return res.status(400).json({ message: "Dados inválidos", details: err.flatten().fieldErrors });
  logger.error({ err });
  return res.status(500).json({ message: "Erro interno." });
}

export const propsController = {
  getPropById: async (req: Request, res: Response) => {
    try {
      const propriedadeId = z.coerce.number().int().positive().parse(req.params.propriedadeId);
      const propriedade = await propriedadeService.getPropById(propriedadeId);
      res.status(200).json(propriedade);
    } catch (err) {
      parseError(res, err);
    }
  },

  buyProp: async (req: Request, res: Response) => {
    try {
      const { propriedadeId, sessionId, userId } = PropBody.parse(req.body);
      const result = await propriedadeService.buyProp(propriedadeId, sessionId, userId);
      await emitUpdatedSession(sessionId);
      res.status(200).json(result);
    } catch (err) {
      parseError(res, err);
    }
  },

  buyHouse: async (req: Request, res: Response) => {
    try {
      const { propriedadeId, sessionId, userId } = PropBody.parse(req.body);
      await propriedadeService.buyHouse(userId, sessionId, propriedadeId);
      await emitUpdatedSession(sessionId);
      return res.status(200).json({ message: "Casa comprada com sucesso!" });
    } catch (err) {
      return parseError(res, err);
    }
  },

  buyHousesBatch: async (req: Request, res: Response) => {
    try {
      const { sessionId, userId } = SessionPlayerBody.parse(req.body);
      const sessaoPossesIds = z.array(z.number().int().positive()).min(1).parse(req.body.sessaoPossesIds);
      await propriedadeService.buyHousesBatch(userId, sessionId, sessaoPossesIds);
      await emitUpdatedSession(sessionId);
      return res.status(200).json({ message: "Casas compradas com sucesso!" });
    } catch (err) {
      return parseError(res, err);
    }
  },

  sellHousesBatch: async (req: Request, res: Response) => {
    try {
      const { sessionId, userId } = SessionPlayerBody.parse(req.body);
      const items = z.array(z.object({
        sessaoPossesId: z.number().int().positive(),
        quantidade: z.number().int().min(1),
      })).min(1).parse(req.body.items);
      await propriedadeService.sellHousesBatch(userId, sessionId, items);
      await emitUpdatedSession(sessionId);
      return res.status(200).json({ message: "Casas vendidas com sucesso!" });
    } catch (err) {
      return parseError(res, err);
    }
  },

  sellHouse: async (req: Request, res: Response) => {
    try {
      const { propriedadeId, sessionId, userId } = PropBody.parse(req.body);
      await propriedadeService.sellHouse(userId, sessionId, propriedadeId);
      await emitUpdatedSession(sessionId);
      return res.status(200).json({ message: "Casa vendida com sucesso!" });
    } catch (err) {
      return parseError(res, err);
    }
  },

  sellPropriedade: async (req: Request, res: Response) => {
    try {
      const { propriedadeId, sessionId, userId } = PropBody.parse(req.body);
      const propriedadeAtualizada = await propriedadeService.sellPropriedade(propriedadeId, sessionId, userId);
      await emitUpdatedSession(sessionId);
      return res.status(200).json({ message: "Propriedade vendida com sucesso!", propriedade: propriedadeAtualizada });
    } catch (err) {
      return parseError(res, err);
    }
  },

  hipotecarPropriedade: async (req: Request, res: Response) => {
    try {
      const { propriedadeId, sessionId, userId } = PropBody.parse(req.body);
      const result = await propriedadeService.hipotecarPropriedade(propriedadeId, sessionId, userId);
      await emitUpdatedSession(sessionId);
      return res.status(200).json({ message: "Propriedade hipotecada com sucesso!", propriedade: result });
    } catch (err) {
      return parseError(res, err);
    }
  },

  comprarHipotecada: async (req: Request, res: Response) => {
    try {
      const body = z.object({
        sessionPossesId: z.coerce.number().int().positive(),
        sessionId: z.coerce.number().int().positive(),
        compradorId: z.coerce.number().int().positive(),
      }).parse(req.body);

      const result = await propriedadeService.comprarHipotecada(
        body.sessionPossesId,
        body.sessionId,
        body.compradorId
      );
      await emitUpdatedSession(body.sessionId);

      const r = result as Record<string, unknown>;
      if (r?.notification) {
        emitNotificationNew(body.sessionId, r.notification as Parameters<typeof emitNotificationNew>[1]);
      }
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  responderNotificacao: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = z.object({
        aceitar: z.boolean(),
        respondedorId: z.coerce.number().int().positive(),
        sessionId: z.coerce.number().int().positive(),
      }).parse(req.body);

      const result = await propriedadeService.responderNotificacao(id, body.aceitar, body.respondedorId);
      await emitUpdatedSession(body.sessionId);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  trocarPropriedade: async (req: Request, res: Response) => {
    try {
      const { propriedadeId, sessionId, userId } = PropBody.parse(req.body);
      await propriedadeService.trocarPropriedade(propriedadeId, sessionId, userId);
      await emitUpdatedSession(sessionId);
      return res.status(200).json({ message: "Propriedade trocada com sucesso!" });
    } catch (err) {
      return parseError(res, err);
    }
  },
};

