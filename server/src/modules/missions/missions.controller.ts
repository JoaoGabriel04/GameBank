import type { Request, Response } from "express";
import { MissionsService } from "./missions.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { missionLogger } from "../../lib/logger.js";

const missionsService = new MissionsService();

export const missionsController = {
  list: async (req: Request, res: Response) => {
    try {
      const missions = await missionsService.getUserMissions(req.user!.userId);
      res.json(missions);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      missionLogger.error({ err }, "erro ao listar missões");
      res.status(500).json({ message: "Erro ao listar missões" });
    }
  },

  claimAll: async (req: Request, res: Response) => {
    try {
      const result = await missionsService.claimAllMissions(req.user!.userId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      missionLogger.error({ err }, "erro ao resgatar todas as missões");
      res.status(500).json({ message: "Erro ao resgatar todas as missões" });
    }
  },

  claim: async (req: Request, res: Response) => {
    try {
      const missionId = parseInt(req.params.id, 10);
      if (isNaN(missionId)) {
        return res.status(400).json({ message: "ID de missão inválido" });
      }

      const result = await missionsService.claimMission(req.user!.userId, missionId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      missionLogger.error({ err }, "erro ao resgatar missão");
      res.status(500).json({ message: "Erro ao resgatar missão" });
    }
  },
};

