import { z } from "zod";
import type { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { AuthService } from "./auth.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { authRepository } from "./auth.repository.js";
import { CompleteProfileSchema } from "../../shared/schemas/auth.schema.js";
import { toAuthUserPayload } from "../../utils/auth-user.js";

const authService = new AuthService();

const emailSchema = z
  .string()
  .email("Email inválido")
  .transform((value) => value.trim().toLowerCase());
const senhaMin6 = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

export const avatarProfileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AVATAR_UPLOAD_RATE_LIMIT || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitos uploads de avatar. Tente novamente em 1 minuto." },
  keyGenerator: (req) => req.user?.userId != null ? String(req.user.userId) : ipKeyGenerator(req.ip ?? ""),
});

function parseError(res: Response, err: unknown) {
  if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Dados inválidos", details: err.flatten().fieldErrors });
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
}

function oauthRedirect(res: Response, result: { token: string; user: { profileComplete: boolean } }) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const setup = result.user.profileComplete ? "" : "&setup=1";
  res.redirect(`${clientUrl}/auth/callback?token=${result.token}${setup}`);
}

export const authController = {
  register: async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: emailSchema,
        senha: senhaMin6,
      });
      const { email, senha } = schema.parse(req.body);
      const result = await authService.register(email, senha);
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

  completeProfile: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const email = req.user!.email;
      const parsed = CompleteProfileSchema.parse({
        nome: req.body.nome,
        avatarPreset: req.body.avatarPreset || undefined,
      });

      const file = req.file;
      const result = await authService.completeProfile(userId, email, parsed.nome, {
        avatarPreset: parsed.avatarPreset,
        fileBuffer: file?.buffer,
        fileMime: file?.mimetype,
      });

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
      oauthRedirect(res, result);
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
      oauthRedirect(res, result);
    } catch {
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      res.redirect(`${clientUrl}/auth/callback?error=discord_falhou`);
    }
  },

  me: async (req: Request, res: Response) => {
    try {
      const user = await authRepository.findById(req.user!.userId);
      if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
      res.json(toAuthUserPayload(user));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro interno" });
    }
  },
};
