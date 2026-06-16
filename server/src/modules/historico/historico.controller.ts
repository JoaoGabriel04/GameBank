import type { Request, Response } from "express";
import { HistoricoService } from "./historico.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { logger } from "../../lib/logger.js";

const historicoService = new HistoricoService();

export const historicoController = {
  test: (_req: Request, res: Response) => {
    res.send("Hello World! Esse é o histórico.");
  },

  all: async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const historico = await historicoService.listBySession(parseInt(id));
      res.status(200).json(historico);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro ao buscar históricos!");
      res.status(500).json({ message: "Erro ao buscar históricos" });
    }
  },
};

