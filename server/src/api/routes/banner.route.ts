import { Router } from "express";
import { adminRepository } from "../../modules/admin/admin.repository.js";

const bannerRouter = Router();

bannerRouter.get("/", async (_req, res) => {
  try {
    const banners = await adminRepository.findAllBanners();
    res.json(
      banners.map((b) => ({
        id: b.id,
        name: b.nome,
        css: b.css,
        spriteId: b.spriteId ?? null,
        imagePublicId: b.imagePublicId ?? null,
        imageUpdatedAt: b.imageUpdatedAt ? b.imageUpdatedAt.toISOString() : null,
        available: b.disponibilidade,
      }))
    );
  } catch (err) {
    console.error("Erro ao listar banners públicos:", err);
    res.status(500).json({ message: "Erro ao listar banners" });
  }
});

export default bannerRouter;
