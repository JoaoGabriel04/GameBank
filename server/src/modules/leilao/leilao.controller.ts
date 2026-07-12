import { z } from "zod";
import type { Request, Response } from "express";
import { turnoService } from "../turno/turno.service.js";
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

export const leilaoController = {
  // Body: { valor: number } — 0 = passar (não quer participar)
  darLance: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const schema = z.object({ valor: z.coerce.number().int().min(0) });
      const { valor } = schema.parse(req.body);
      const userId = req.user!.userId;

      const player = await sessionService.getPlayerByUser(sessionId, userId);
      if (!player) throw new AppError(404, "Você não está nesta sala.");

      const result = await turnoService.darLance(sessionId, player.id, valor);
      res.status(200).json(result);
    } catch (err) {
      parseError(res, err);
    }
  },
};
