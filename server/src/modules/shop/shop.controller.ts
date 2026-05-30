import type { Request, Response } from "express";
import { ShopService } from "./shop.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";

const shopService = new ShopService();

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
      const result = await shopService.buyItem(req.user!.userId, parseInt(req.params.itemId));
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao comprar item:", err);
      res.status(500).json({ message: "Erro ao comprar item" });
    }
  },

  equipItem: async (req: Request, res: Response) => {
    try {
      const result = await shopService.equipItem(req.user!.userId, parseInt(req.params.itemId));
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Erro ao equipar item:", err);
      res.status(500).json({ message: "Erro ao equipar item" });
    }
  },
};

export default shopController;
