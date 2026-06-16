import type { Request, Response } from "express";
import { RankingService } from "./ranking.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { logger } from "../../lib/logger.js";

const rankingService = new RankingService();

export const rankingController = {
  global: async (_req: Request, res: Response) => {
    try {
      const ranking = await rankingService.getGlobalRanking();
      res.json(ranking);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      logger.error({ err }, "Erro ao buscar ranking");
      res.status(500).json({ message: "Erro ao buscar ranking" });
    }
  },
};

