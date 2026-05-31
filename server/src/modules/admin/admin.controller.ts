import { z } from "zod";
import type { Request, Response } from "express";
import { AdminService } from "./admin.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";

const adminService = new AdminService();

const ItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().int().min(0),
  type: z.enum(["title", "badge", "color"]),
  value: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  available: z.boolean(),
});

function parseError(res: Response, err: unknown) {
  if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Dados inválidos", details: err.flatten().fieldErrors });
  console.error(err);
  return res.status(500).json({ error: "Erro interno." });
}

export const adminController = {
  // ShopItems
  listItems: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.listItems());
    } catch (err) { parseError(res, err); }
  },

  createItem: async (req: Request, res: Response) => {
    try {
      const data = ItemSchema.parse(req.body);
      res.status(201).json(await adminService.createItem(data));
    } catch (err) { parseError(res, err); }
  },

  updateItem: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const data = ItemSchema.partial().parse(req.body);
      res.json(await adminService.updateItem(id, data));
    } catch (err) { parseError(res, err); }
  },

  toggleItem: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      res.json(await adminService.toggleItem(id));
    } catch (err) { parseError(res, err); }
  },

  deleteItem: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      await adminService.deleteItem(id);
      res.status(204).send();
    } catch (err) { parseError(res, err); }
  },

  // Users
  listUsers: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.listUsers());
    } catch (err) { parseError(res, err); }
  },

  adjustCoins: async (req: Request, res: Response) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.id);
      const { delta } = z.object({ delta: z.number().int() }).parse(req.body);
      res.json(await adminService.adjustCoins(userId, delta));
    } catch (err) { parseError(res, err); }
  },
};
