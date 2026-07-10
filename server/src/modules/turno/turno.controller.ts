import { z } from "zod";
import type { Request, Response } from "express";
import { turnoService } from "./turno.service.js";
import { SessionService } from "../session/session.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { logger } from "../../lib/logger.js";

const sessionService = new SessionService();

function parseError(res: Response, err: unknown) {
  if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
  if (err instanceof z.ZodError) return res.status(400).json({ message: "Dados inválidos", details: err.flatten().fieldErrors });
  logger.error({ err });
  return res.status(500).json({ message: "Erro interno." });
}

export const turnoController = {
  passarVez: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const userId = req.user!.userId;

      const player = await sessionService.getPlayerByUser(sessionId, userId);
      if (!player) throw new AppError(404, "Você não está nesta sala.");

      const result = await turnoService.passarVez(sessionId, player.id);
      res.status(200).json(result);
    } catch (err) {
      parseError(res, err);
    }
  },

  rolarDados: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const userId = req.user!.userId;

      const player = await sessionService.getPlayerByUser(sessionId, userId);
      if (!player) throw new AppError(404, "Você não está nesta sala.");

      const result = await turnoService.rolarDados(sessionId, player.id);
      res.status(200).json(result);
    } catch (err) {
      parseError(res, err);
    }
  },

  comprarCasaAtual: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const userId = req.user!.userId;

      const player = await sessionService.getPlayerByUser(sessionId, userId);
      if (!player) throw new AppError(404, "Você não está nesta sala.");

      const result = await turnoService.comprarCasaAtual(sessionId, player.id);
      res.status(200).json(result);
    } catch (err) {
      parseError(res, err);
    }
  },

  recusarCompra: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const userId = req.user!.userId;

      const player = await sessionService.getPlayerByUser(sessionId, userId);
      if (!player) throw new AppError(404, "Você não está nesta sala.");

      const result = await turnoService.recusarCompra(sessionId, player.id);
      res.status(200).json(result);
    } catch (err) {
      parseError(res, err);
    }
  },
};
