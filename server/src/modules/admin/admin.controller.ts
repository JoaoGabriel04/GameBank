import { z } from "zod";
import type { Request, Response } from "express";
import { AdminService } from "./admin.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";

const adminService = new AdminService();

const ItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().int().min(0),
  type: z.enum(["title", "badge"]),
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

  // Sessions
  listSessions: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.listSessions());
    } catch (err) { parseError(res, err); }
  },

  // Missions
  listMissions: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.listMissions());
    } catch (err) { parseError(res, err); }
  },

  createMission: async (req: Request, res: Response) => {
    try {
      const data = z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        metric: z.string().min(1),
        target: z.number().positive(),
        xpReward: z.number().int().min(0),
        coinReward: z.number().int().min(0),
        perGame: z.boolean(),
        active: z.boolean(),
      }).parse(req.body);
      res.status(201).json(await adminService.createMission(data));
    } catch (err) { parseError(res, err); }
  },

  updateMission: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const data = z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        metric: z.string().min(1),
        target: z.number().positive(),
        xpReward: z.number().int().min(0),
        coinReward: z.number().int().min(0),
        perGame: z.boolean(),
        active: z.boolean(),
      }).partial().parse(req.body);
      res.json(await adminService.updateMission(id, data));
    } catch (err) { parseError(res, err); }
  },

  deleteMission: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      await adminService.deleteMission(id);
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

  // Cards
  listCards: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.listCards());
    } catch (err) { parseError(res, err); }
  },

  createCard: async (req: Request, res: Response) => {
    try {
      const data = z.object({
        tipo: z.string().min(1),
        texto: z.string().min(1),
        efeito: z.string().min(1),
        valor: z.number().int().min(0),
        ativo: z.boolean(),
      }).parse(req.body);
      res.status(201).json(await adminService.createCard(data));
    } catch (err) { parseError(res, err); }
  },

  updateCard: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const data = z.object({
        tipo: z.string().min(1),
        texto: z.string().min(1),
        efeito: z.string().min(1),
        valor: z.number().int().min(0),
        ativo: z.boolean(),
      }).partial().parse(req.body);
      res.json(await adminService.updateCard(id, data));
    } catch (err) { parseError(res, err); }
  },

  deleteCard: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      await adminService.deleteCard(id);
      res.status(204).send();
    } catch (err) { parseError(res, err); }
  },

  // GameSettings
  getSettings: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.getSettings());
    } catch (err) { parseError(res, err); }
  },

  updateSettings: async (req: Request, res: Response) => {
    try {
      const data = z.record(z.string(), z.any()).parse(req.body);
      res.json(await adminService.updateSettings(data));
    } catch (err) { parseError(res, err); }
  },

  // Banners
  listBanners: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.listBanners());
    } catch (err) { parseError(res, err); }
  },

  createBanner: async (req: Request, res: Response) => {
    try {
      const data = z.object({
        nome: z.string().min(1),
        css: z.string().min(1),
        spriteId: z.string().optional(),
        disponibilidade: z.boolean().default(true),
      }).parse(req.body);
      res.status(201).json(await adminService.createBanner(data));
    } catch (err) { parseError(res, err); }
  },

  updateBanner: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const data = z.object({
        nome: z.string().min(1),
        css: z.string().min(1),
        spriteId: z.string(),
        disponibilidade: z.boolean(),
      }).partial().parse(req.body);
      res.json(await adminService.updateBanner(id, data));
    } catch (err) { parseError(res, err); }
  },

  deleteBanner: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      await adminService.deleteBanner(id);
      res.status(204).send();
    } catch (err) { parseError(res, err); }
  },

  getDashboard: async (_req: Request, res: Response) => {
    try {
      const [
        totalUsers, totalSessions, totalFinished, totalItems,
        recentUsers, recentSessions, recentGames,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.session.count(),
        prisma.session.count({ where: { status: "Finalizada" } }),
        prisma.shopItem.count(),
        prisma.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, nome: true, email: true, avatarUrl: true, avatarUpdatedAt: true, createdAt: true },
        }),
        prisma.session.findMany({
          orderBy: { dataInicio: "desc" },
          take: 5,
          select: {
            id: true, nome: true, status: true, maxJogadores: true, dataInicio: true,
            jogadores: { select: { id: true } },
          },
        }),
        prisma.gameResult.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          where: { position: 1 },
          include: { user: { select: { nome: true } } },
        }),
      ]);
      res.json({ totalUsers, totalSessions, totalFinished, totalItems, recentUsers, recentSessions, recentGames });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erro ao carregar dashboard" });
    }
  },
};
