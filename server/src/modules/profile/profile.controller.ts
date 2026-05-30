import type { Request, Response } from "express";
import { ProfileService } from "./profile.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";

const profileService = new ProfileService();

export const profileController = {
  me: async (req: Request, res: Response) => {
    try {
      const profile = await profileService.getProfile(req.user!.userId);
      res.json(profile);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao buscar perfil:", err);
      res.status(500).json({ message: "Erro ao buscar perfil" });
    }
  },

  history: async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const history = await profileService.getHistory(req.user!.userId, limit);
      res.json(history);
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
      res.status(500).json({ message: "Erro ao buscar histórico" });
    }
  },

  updateMe: async (req: Request, res: Response) => {
    try {
      const nome = typeof req.body.nome === "string" ? req.body.nome.trim() : undefined;
      const avatarPreset = req.body.avatarPreset || undefined;
      const banner = req.body.banner || undefined;
      const fileBuffer = req.file?.buffer;
      const fileMime = req.file?.mimetype;

      const result = await profileService.updateProfile(req.user!.userId, {
        nome,
        avatarPreset,
        fileBuffer,
        fileMime,
        banner,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
      console.error("Erro ao atualizar perfil:", err);
      res.status(500).json({ error: "Erro ao atualizar perfil" });
    }
  },
};

export default profileController;
