import { z } from "zod";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";

const authService = new AuthService();

const emailSchema = z.string().email("Email inválido");
const senhaMin6 = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

function parseError(res: Response, err: unknown) {
  if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Dados inválidos", details: err.flatten().fieldErrors });
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
}

export const authController = {
  register: async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: emailSchema,
        nome: z.string().min(1, "Nome obrigatório").max(100).trim(),
        senha: senhaMin6,
      });
      const { email, nome, senha } = schema.parse(req.body);
      const result = await authService.register(email, nome, senha);
      res.status(201).json(result);
    } catch (err) {
      parseError(res, err);
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: emailSchema,
        senha: z.string().min(1, "Senha obrigatória"),
      });
      const { email, senha } = schema.parse(req.body);
      const result = await authService.login(email, senha);
      res.json(result);
    } catch (err) {
      parseError(res, err);
    }
  },

  google: (_req: Request, res: Response) => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set("redirect_uri", `${process.env.API_URL || "http://localhost:7000"}/api/auth/google/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "email profile");
    res.redirect(url.toString());
  },

  googleCallback: async (req: Request, res: Response) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== "string") throw new AppError(400, "Código inválido");
      const result = await authService.googleCallback(code);
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      res.redirect(`${clientUrl}/auth/callback?token=${result.token}`);
    } catch {
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      res.redirect(`${clientUrl}/auth/callback?error=google_falhou`);
    }
  },

  discord: (_req: Request, res: Response) => {
    const url = new URL("https://discord.com/api/oauth2/authorize");
    url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID!);
    url.searchParams.set("redirect_uri", `${process.env.API_URL || "http://localhost:7000"}/api/auth/discord/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify email");
    res.redirect(url.toString());
  },

  discordCallback: async (req: Request, res: Response) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== "string") throw new AppError(400, "Código inválido");
      const result = await authService.discordCallback(code);
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      res.redirect(`${clientUrl}/auth/callback?token=${result.token}`);
    } catch {
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      res.redirect(`${clientUrl}/auth/callback?error=discord_falhou`);
    }
  },

  me: async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { id: true, email: true, nome: true, avatarUrl: true },
      });
      if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro interno" });
    }
  },
};
