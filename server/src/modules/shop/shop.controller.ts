import type { Request, Response } from "express";
import { ShopService } from "./shop.service.js";
import { DailyOffersService } from "./daily-offers.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";

const shopService = new ShopService();
const dailyOffersService = new DailyOffersService();

export const shopController = {
  listItems: async (_req: Request, res: Response) => {
    try {
      const items = await shopService.listItems();
      res.json(items);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao listar itens:", err);
      res.status(500).json({ message: "Erro ao listar itens" });
    }
  },

  buyItem: async (req: Request, res: Response) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (!Number.isFinite(itemId)) {
        return res.status(400).json({ message: "ID de item inválido" });
      }
      const result = await shopService.buyItem(req.user!.userId, itemId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao comprar item:", err);
      res.status(500).json({ message: "Erro ao comprar item" });
    }
  },

  equipItem: async (req: Request, res: Response) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (!Number.isFinite(itemId)) {
        return res.status(400).json({ message: "ID de item inválido" });
      }
      const result = await shopService.equipItem(req.user!.userId, itemId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao equipar item:", err);
      res.status(500).json({ message: "Erro ao equipar item" });
    }
  },

  sellItem: async (req: Request, res: Response) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (!Number.isFinite(itemId)) {
        return res.status(400).json({ message: "ID de item inválido" });
      }
      const result = await shopService.sellItem(req.user!.userId, itemId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao vender item:", err);
      res.status(500).json({ message: "Erro ao vender item" });
    }
  },

  syncBanner: async (req: Request, res: Response) => {
    try {
      await shopService.syncUserBanner(req.user!.userId);
      res.json({ message: "Banner sincronizado" });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao sincronizar banner:", err);
      res.status(500).json({ message: "Erro ao sincronizar banner" });
    }
  },

  buyCoinsWithDiamonds: async (req: Request, res: Response) => {
    try {
      const { packId } = req.body;
      if (!packId) return res.status(400).json({ message: "packId é obrigatório." });
      const result = await shopService.buyCoinsWithDiamonds(req.user!.userId, packId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao comprar coins com diamantes:", err);
      res.status(500).json({ message: "Erro ao comprar coins." });
    }
  },

  buyDiamonds: async (req: Request, res: Response) => {
    try {
      const { packId } = req.body;
      if (!packId) return res.status(400).json({ message: "packId é obrigatório." });
      const result = await shopService.buyDiamonds(req.user!.userId, packId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao comprar diamantes:", err);
      res.status(500).json({ message: "Erro ao comprar diamantes." });
    }
  },

  buyItemWithDiamonds: async (req: Request, res: Response) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (!Number.isFinite(itemId)) {
        return res.status(400).json({ message: "ID de item inválido" });
      }
      const result = await shopService.comprarItemComDiamantes(req.user!.userId, itemId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao comprar item com diamantes:", err);
      res.status(500).json({ message: "Erro ao comprar item com diamantes." });
    }
  },

  catalogo: async (req: Request, res: Response) => {
    try {
      const items = await shopService.catalogo(req.user!.userId);
      res.json(items);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao listar catálogo:", err);
      res.status(500).json({ message: "Erro ao listar catálogo" });
    }
  },

  dailyOffers: async (req: Request, res: Response) => {
    try {
      const offers = await dailyOffersService.getOffers(req.user!.userId);
      res.json(offers);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao listar ofertas diárias:", err);
      res.status(500).json({ message: "Erro ao listar ofertas diárias" });
    }
  },

  buyDailyOffer: async (req: Request, res: Response) => {
    try {
      const offerId = parseInt(req.params.offerId);
      if (!Number.isFinite(offerId)) {
        return res.status(400).json({ message: "ID de oferta inválido" });
      }
      const result = await dailyOffersService.buyOffer(req.user!.userId, offerId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao comprar oferta diária:", err);
      res.status(500).json({ message: "Erro ao comprar oferta diária" });
    }
  },
};

