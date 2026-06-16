import type { Request, Response } from "express";
import { adminRepository } from "../admin/admin.repository.js";
import { logger } from "../../lib/logger.js";

export const bannerController = {
  listPublic: async (_req: Request, res: Response) => {
    try {
      const banners = await adminRepository.findAllBanners();
      res.json(
        banners.map((b) => ({
          id: b.id,
          name: b.nome,
          css: b.css,
          animated: b.animated,
          imagePublicId: b.imagePublicId ?? null,
          imageUpdatedAt: b.imageUpdatedAt ? b.imageUpdatedAt.toISOString() : null,
          available: b.disponibilidade,
        }))
      );
    } catch (err) {
      logger.error({ err }, "Erro ao listar banners públicos");
      res.status(500).json({ message: "Erro ao listar banners" });
    }
  },
}
