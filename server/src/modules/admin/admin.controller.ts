import { z } from "zod";
import type { Request, Response } from "express";
import { AdminService } from "./admin.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";

const adminService = new AdminService();

const noBlobDataUrl = (val: string | null | undefined) =>
  val == null || (!val.startsWith("blob:") && !val.startsWith("data:"));

const ItemSchema = z.object({
  name: z.string().optional(),
  description: z.string().min(1),
  price: z.number().int().min(0),
  type: z.enum(["title", "badge", "banner", "frame"]),
  value: z.string().nullable().optional().refine(noBlobDataUrl, { message: "URL blob/data não são permitidas no campo value" }),
  icon: z.string().nullable().optional(),
  raridade: z.enum(["COMUM", "INCOMUM", "RARO", "EPICO", "LENDARIO"]).default("COMUM"),
  fragmentavel: z.boolean().default(false),
  fragmentosTotal: z.number().int().positive().nullable().optional(),
  fragmentosIcone: z.string().max(2).nullable().optional(),
  available: z.boolean(),
  animated: z.boolean().default(false),
  bannerId: z.number().int().positive().nullable().optional(),
  frameId: z.number().int().positive().nullable().optional(),
  badgeId: z.number().int().positive().nullable().optional(),
});

function parseError(res: Response, err: unknown) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) console.error("[admin]", err);
    else console.warn("[admin]", err.statusCode, err.message);
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err instanceof z.ZodError) {
    console.warn("[admin] ZodError", err.flatten().fieldErrors);
    return res.status(400).json({ error: "Dados inválidos", details: err.flatten().fieldErrors });
  }
  console.error("[admin]", err);
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

  adjustDiamonds: async (req: Request, res: Response) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.id);
      const { delta } = z.object({ delta: z.number().int() }).parse(req.body);
      const user = (req as any).user;
      res.json(await adminService.adjustDiamonds(userId, delta, { id: user?.id, email: user?.email }));
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
        css: z.string().min(1).refine(noBlobDataUrl, { message: "URL blob/data não são permitidas" }),
        animated: z.boolean().default(false),
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
        css: z.string().min(1).refine(noBlobDataUrl, { message: "URL blob/data não são permitidas" }).optional(),
        animated: z.boolean().optional(),
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

  // Frames
  listFrames: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.listFrames());
    } catch (err) { parseError(res, err); }
  },

  createFrame: async (req: Request, res: Response) => {
    try {
      const data = z.object({
        nome: z.string().min(1),
        css: z.string().min(1).refine(noBlobDataUrl, { message: "URL blob/data não são permitidas" }),
        animated: z.boolean().default(false),
        disponibilidade: z.boolean().default(true),
        frameScale: z.number().int().min(100).max(200).optional(),
      }).parse(req.body);
      res.status(201).json(await adminService.createFrame(data));
    } catch (err) { parseError(res, err); }
  },

  updateFrame: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const data = z.object({
        nome: z.string().min(1).optional(),
        css: z.string().min(1).refine(noBlobDataUrl, { message: "URL blob/data não são permitidas" }).optional(),
        animated: z.boolean().optional(),
        disponibilidade: z.boolean().optional(),
        frameScale: z.number().int().min(100).max(200).optional(),
      }).parse(req.body);
      const user = (req as any).user;
      res.json(await adminService.updateFrame(id, data, { id: user?.userId, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  deleteFrame: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const user = (req as any).user;
      await adminService.deleteFrame(id, { id: user?.userId, email: user?.email });
      res.status(204).send();
    } catch (err) { parseError(res, err); }
  },

  uploadFrameImage: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const fileBuffer = req.file?.buffer;
      const fileMime = req.file?.mimetype;
      if (!fileBuffer) return res.status(400).json({ error: "Nenhuma imagem enviada" });
      const user = (req as any).user;
      res.json(await adminService.uploadFrameImage(id, fileBuffer, fileMime, { id: user?.userId, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  uploadBadgeImage: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const fileBuffer = req.file?.buffer;
      const fileMime = req.file?.mimetype;
      if (!fileBuffer) return res.status(400).json({ error: "Nenhuma imagem enviada" });
      const user = (req as any).user;
      res.json(await adminService.uploadBadgeImage(id, fileBuffer, fileMime, { id: user?.userId, email: user?.email }));
    } catch (err) { parseError(res, err); }
  },

  // Badges CRUD
  listBadges: async (_req: Request, res: Response) => {
    try {
      res.json(await adminService.listBadges());
    } catch (err) { parseError(res, err); }
  },

  createBadge: async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        nome: z.string().min(1),
        disponibilidade: z.boolean().default(true),
      });
      const data = schema.parse(req.body);
      res.status(201).json(await adminService.createBadge(data));
    } catch (err) { parseError(res, err); }
  },

  updateBadge: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const schema = z.object({
        nome: z.string().min(1).optional(),
        disponibilidade: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      res.json(await adminService.updateBadge(id, data));
    } catch (err) { parseError(res, err); }
  },

  deleteBadge: async (req: Request, res: Response) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      await adminService.deleteBadge(id);
      res.status(204).send();
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
      const nowDate = new Date();
      const sevenDaysAgo = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(nowDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const todayStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()));

      const [
        totalUsers, totalSessions, totalFinished, totalItems,
        recentUsers, recentSessionsRaw, recentGames,
        countUsersThisWeek, countUsersLastWeek,
        countSessionsThisWeek, countSessionsLastWeek,
        activeUsersTodayRaw, ativosEssaSemanaRaw, ativosSemanaPassadaRaw,
        usersLast30Raw, sessionsLast30Raw,
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
        // G: deltas semana-a-semana
        prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
        prisma.session.count({ where: { dataInicio: { gte: sevenDaysAgo } } }),
        prisma.session.count({ where: { dataInicio: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
        // H: ativos hoje
        prisma.gameResult.findMany({
          where: { createdAt: { gte: todayStart } },
          distinct: ["userId"],
          select: { userId: true },
        }),
        // I: retenção — ativos nos últimos 7 dias
        prisma.gameResult.findMany({
          where: { createdAt: { gte: sevenDaysAgo } },
          distinct: ["userId"],
          select: { userId: true },
        }),
        // I: retenção — ativos nos 7 dias anteriores
        prisma.gameResult.findMany({
          where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
          distinct: ["userId"],
          select: { userId: true },
        }),
        // J: série temporal — novos usuários por dia (30 dias)
        prisma.user.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { createdAt: true },
        }),
        // J: série temporal — sessões por dia (30 dias)
        prisma.session.findMany({
          where: { dataInicio: { gte: thirtyDaysAgo } },
          select: { dataInicio: true },
        }),
      ]);

      function calcDelta(curr: number, prev: number): number | null {
        return prev > 0 ? Math.round(((curr - prev) / prev) * 100 * 10) / 10 : null;
      }

      function buildDailyArray(dates: Date[], days: number): number[] {
        const counts = new Array(days).fill(0);
        const nowMs = nowDate.getTime();
        for (const d of dates) {
          const daysAgo = Math.floor((nowMs - d.getTime()) / (24 * 60 * 60 * 1000));
          if (daysAgo >= 0 && daysAgo < days) counts[days - 1 - daysAgo]++;
        }
        return counts;
      }

      const userGrowth30d = buildDailyArray(usersLast30Raw.map((u) => u.createdAt), 30);
      const sessions30d = buildDailyArray(sessionsLast30Raw.map((s) => s.dataInicio), 30);

      const setEssaSemana = new Set(ativosEssaSemanaRaw.map((r) => r.userId));
      const retidos = ativosSemanaPassadaRaw.filter((r) => setEssaSemana.has(r.userId)).length;
      const weeklyRetention = ativosSemanaPassadaRaw.length > 0
        ? Math.round((retidos / ativosSemanaPassadaRaw.length) * 100)
        : null;

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

      res.json({
        totalUsers, totalSessions, totalFinished, totalItems,
        recentUsers, recentSessions, recentGames,
        userGrowth30d,
        sessions30d,
        deltaUsers: calcDelta(countUsersThisWeek, countUsersLastWeek),
        deltaSessions: calcDelta(countSessionsThisWeek, countSessionsLastWeek),
        activeUsersToday: activeUsersTodayRaw.length,
        weeklyRetention,
      });
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

  // K — chat de sessão
  getSessionChat: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.id);
      const messages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { player: { select: { nome: true, cor: true } } },
      });
      res.json(messages);
    } catch (err) { parseError(res, err); }
  },

  // L — notificar usuários (batch)
  notifyUsers: async (req: Request, res: Response) => {
    try {
      const { userIds, titulo, corpo } = z.object({
        userIds: z.array(z.number().int().positive()).min(1),
        titulo: z.string().min(1).max(100),
        corpo: z.string().min(1).max(500),
      }).parse(req.body);
      await prisma.userNotification.createMany({
        data: userIds.map((userId) => ({ userId, titulo, corpo })),
      });
      res.json({ sent: userIds.length });
    } catch (err) { parseError(res, err); }
  },
};
