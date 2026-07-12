import { z } from "zod";
import type { Request, Response } from "express";
import { EmprestimoService } from "./emprestimo.service.js";
import { SessionService } from "../session/session.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { logger } from "../../lib/logger.js";

const emprestimoService = new EmprestimoService();
const sessionService = new SessionService();

const PegarSchema = z.object({
  valor: z.number().int().positive(),
});

function parseError(res: Response, err: unknown) {
  if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
  if (err instanceof z.ZodError) return res.status(400).json({ message: "Dados inválidos", details: err.flatten().fieldErrors });
  logger.error({ err });
  return res.status(500).json({ message: "Erro interno." });
}

export const emprestimoController = {
  getLimite: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const userId = req.user!.userId;
      const player = await sessionService.getPlayerByUser(sessionId, userId);
      if (!player) throw new AppError(404, "Você não está nesta sala.");
      const result = await emprestimoService.getLimite(sessionId, player.id);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  pegar: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const userId = req.user!.userId;
      const player = await sessionService.getPlayerByUser(sessionId, userId);
      if (!player) throw new AppError(404, "Você não está nesta sala.");
      const { valor } = PegarSchema.parse(req.body);
      const result = await emprestimoService.pegarEmprestimo(sessionId, player.id, valor);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  quitar: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const userId = req.user!.userId;
      const player = await sessionService.getPlayerByUser(sessionId, userId);
      if (!player) throw new AppError(404, "Você não está nesta sala.");
      const result = await emprestimoService.quitarEmprestimo(sessionId, player.id);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },
};
