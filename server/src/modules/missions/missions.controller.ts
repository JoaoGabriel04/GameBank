import type { Request, Response } from "express";
import { MissionsService } from "./missions.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";

const missionsService = new MissionsService();

export const missionsController = {
  list: async (req: Request, res: Response) => {
    try {
      const missions = await missionsService.getUserMissions(req.user!.userId);
      res.json(missions);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao listar missões:", err);
      res.status(500).json({ message: "Erro ao listar missões" });
    }
  },
};

export default missionsController;
