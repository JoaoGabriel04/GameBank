import { z } from "zod";
import type { Request, Response } from "express";
import { AdminService } from "./admin.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";

const adminService = new AdminService();

const ItemSchema = z.object({
  name: z.string().optional(),
  description: z.string().min(1),
  price: z.number().int().min(0),
  type: z.enum(["title", "badge", "banner"]),
  value: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  available: z.boolean(),
  bannerId: z.number().int().positive().nullable().optional(),
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
      const user = (req as any).user;
      await adminService.deleteItem(id, { id: user?.userId, email: user?.email });
      res.status(204).send();
    } catch (err) { parseError(res, err); }
  },

  // Sessions
  listSessions: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.listSessions());
    } catch (err) { parseError(res, err); }
  },

  getSessionDetail: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      res.json(await adminService.getSessionDetail(id));
    } catch (err) { parseError(res, err); }
  },

  endSession: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const user = (req as any).user;
      res.json(await adminService.endSession(id, { id: user?.id, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  adjustPlayerBalance: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const pid = z.coerce.number().int().positive().parse(req.params.pid);
      const { delta } = z.object({ delta: z.number().finite() }).parse(req.body);
      const user = (req as any).user;
      res.json(await adminService.adjustPlayerBalance(pid, delta, { id: user?.id, email: user?.email }));
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

  toggleMission: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const user = (req as any).user;
      res.json(await adminService.toggleMission(id, { id: user?.id, email: user?.email }));
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
      const user = (req as any).user;
      res.json(await adminService.adjustCoins(userId, delta, { id: user?.id, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  adjustXp: async (req: Request, res: Response) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.id);
      const { delta } = z.object({ delta: z.number().int() }).parse(req.body);
      const user = (req as any).user;
      res.json(await adminService.adjustXp(userId, delta, { id: user?.id, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  setLevel: async (req: Request, res: Response) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.id);
      const { level } = z.object({ level: z.number().int().min(1).max(100) }).parse(req.body);
      const user = (req as any).user;
      res.json(await adminService.setLevel(userId, level, { id: user?.id, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  banUser: async (req: Request, res: Response) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.id);
      const { reason } = z.object({ reason: z.string().optional() }).parse(req.body ?? {});
      const user = (req as any).user;
      res.json(await adminService.banUser(userId, reason, { id: user?.id, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  unbanUser: async (req: Request, res: Response) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.id);
      const user = (req as any).user;
      res.json(await adminService.unbanUser(userId, { id: user?.id, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  setUserAdmin: async (req: Request, res: Response) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.id);
      const { isAdmin } = z.object({ isAdmin: z.boolean() }).parse(req.body);
      const user = (req as any).user;
      res.json(await adminService.setUserAdmin(userId, isAdmin, { id: user?.id, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  deleteUser: async (req: Request, res: Response) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.id);
      const user = (req as any).user;
      await adminService.deleteUser(userId, { id: user?.userId, email: user?.email });
      res.status(204).send();
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
        nome: z.string().min(1).optional(),
        css: z.string().min(1).optional(),
        spriteId: z.string().optional(),
        disponibilidade: z.boolean().optional(),
      }).parse(req.body);
      const user = (req as any).user;
      res.json(await adminService.updateBanner(id, data, { id: user?.userId, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  deleteBanner: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const user = (req as any).user;
      await adminService.deleteBanner(id, { id: user?.userId, email: user?.email });
      res.status(204).send();
    } catch (err) { parseError(res, err); }
  },

  uploadBannerImage: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const fileBuffer = req.file?.buffer;
      const fileMime = req.file?.mimetype;
      if (!fileBuffer) return res.status(400).json({ error: "Nenhuma imagem enviada" });
      const user = (req as any).user;
      res.json(await adminService.uploadBannerImage(id, fileBuffer, fileMime, { id: user?.userId, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  syncUserBanner: async (req: Request, res: Response) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.id);
      const user = (req as any).user;
      res.json(await adminService.syncUserBanner(userId, { id: user?.userId, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  getDashboard: async (_req: Request, res: Response) => {
    try {
      const [
        totalUsers, totalSessions, totalFinished, totalItems,
        recentUsers, recentSessionsRaw, recentGames,
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
            id: true, nome: true, status: true, modo: true, maxJogadores: true,
            saldoInicial: true, dataInicio: true,
            jogadores: { select: { id: true, saldo: true } },
          },
        }),
        prisma.gameResult.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          where: { position: 1 },
          include: { user: { select: { nome: true } } },
        }),
      ]);
      const now = Date.now();
      const recentSessions = recentSessionsRaw.map((s) => ({
        id: s.id,
        nome: s.nome,
        status: s.status,
        modo: s.modo,
        maxJogadores: s.maxJogadores,
        dataInicio: s.dataInicio,
        jogadores: s.jogadores.map((j) => ({ id: j.id })),
        saldoTotal: s.jogadores.reduce((acc, j) => acc + (j.saldo ?? 0), 0),
        duracao: Math.max(0, Math.floor((now - s.dataInicio.getTime()) / 1000)),
      }));
      res.json({ totalUsers, totalSessions, totalFinished, totalItems, recentUsers, recentSessions, recentGames });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erro ao carregar dashboard" });
    }
  },

  listAudit: async (req: Request, res: Response) => {
    try {
      const { userId, action, severity, limit, offset } = z.object({
        userId: z.coerce.number().int().positive().optional(),
        action: z.string().optional(),
        severity: z.enum(["info", "success", "warn", "danger"]).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
        offset: z.coerce.number().int().min(0).optional(),
      }).parse(req.query);
      res.json(await adminService.listAudit({ userId, action, severity, limit, offset }));
    } catch (err) { parseError(res, err); }
  },
};
