import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { isPrismaUniqueViolation, normalizeEmail } from "../../utils/email.js";
import { toAuthUserPayload } from "../../utils/auth-user.js";
import { presetAvatarValue, isAllowedAvatarPreset } from "../../shared/constants/avatars.js";
import { validateAndProcessAvatar } from "../../lib/image-validation.js";
import {
  uploadAvatarToCloudinary,
  deleteCloudinaryAvatar,
  rollbackCloudinaryUpload,
} from "../avatar/avatar.service.js";

type OAuthProvider = "google" | "discord";

export class AuthService {
  private async findUserByEmail(email: string) {
    const normalized = normalizeEmail(email);
    const exact = await prisma.user.findUnique({ where: { email: normalized } });
    if (exact) return exact;

    const insensitive = await prisma.user.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" } },
    });
    if (!insensitive) return null;
    if (insensitive.email === normalized) return insensitive;

    try {
      return await prisma.user.update({
        where: { id: insensitive.id },
        data: { email: normalized },
      });
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        return prisma.user.findUnique({ where: { email: normalized } });
      }
      throw err;
    }
  }

  private authResponse(user: {
    id: number;
    email: string;
    nome: string;
    avatarUrl: string | null;
    avatarUpdatedAt: Date | null;
    profileComplete: boolean;
  }) {
    const token = signToken({ userId: user.id, email: user.email });
    return { token, user: toAuthUserPayload(user) };
  }

  async register(email: string, senha: string) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.findUserByEmail(normalizedEmail);
    if (existing) throw new AppError(409, "Email já cadastrado");

    const passwordHash = await bcrypt.hash(senha, 12);
    try {
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          nome: "",
          passwordHash,
          profileComplete: false,
        },
      });
      return this.authResponse(user);
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        throw new AppError(409, "Email já cadastrado");
      }
      throw err;
    }
  }

  async login(email: string, senha: string) {
    const user = await this.findUserByEmail(email);
    if (!user || !user.passwordHash) {
      throw new AppError(401, "Email ou senha inválidos");
    }

    const valida = await bcrypt.compare(senha, user.passwordHash);
    if (!valida) throw new AppError(401, "Email ou senha inválidos");

    return this.authResponse(user);
  }

  async completeProfile(
    userId: number,
    nome: string,
    options: { avatarPreset?: string; fileBuffer?: Buffer; fileMime?: string }
  ) {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new AppError(404, "Usuário não encontrado");

    let newAvatarUrl: string;
    let newPublicId: string | null = null;

    if (options.avatarPreset) {
      if (!isAllowedAvatarPreset(options.avatarPreset)) {
        throw new AppError(400, "Avatar preset inválido");
      }
      newAvatarUrl = presetAvatarValue(options.avatarPreset);
    } else if (options.fileBuffer) {
      console.log("[avatar] Upload iniciado — userId:", userId);
      const processed = await validateAndProcessAvatar(options.fileBuffer, options.fileMime);
      const uploaded = await uploadAvatarToCloudinary(userId, processed.buffer);
      newAvatarUrl = uploaded.url;
      newPublicId = uploaded.publicId;
    } else {
      throw new AppError(400, "Escolha um avatar ou envie uma foto");
    }

    const oldPublicId = current.avatarPublicId;

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          nome,
          avatarUrl: newAvatarUrl,
          avatarPublicId: newPublicId,
          avatarUpdatedAt: new Date(),
          profileComplete: true,
        },
      });

      if (oldPublicId && oldPublicId !== newPublicId) {
        deleteCloudinaryAvatar(oldPublicId).catch((err) => {
          console.error("[avatar] Exclusão antiga falhou — reagendar limpeza:", oldPublicId, err);
        });
      }

      console.log("[avatar] Perfil atualizado — userId:", userId);
      return { user: toAuthUserPayload(user) };
    } catch (err) {
      if (newPublicId) {
        await rollbackCloudinaryUpload(newPublicId);
      }
      throw err;
    }
  }

  async googleCallback(code: string) {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.API_URL || "http://localhost:7000"}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens: any = await tokenResponse.json();
    if (!tokens.access_token) throw new AppError(401, "Falha na autenticação com Google");

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser: any = await userResponse.json();

    if (!googleUser.email) throw new AppError(400, "Google não forneceu email");

    const user = await this.findOrLinkOAuthUser({
      provider: "google",
      providerId: googleUser.id,
      email: normalizeEmail(googleUser.email),
    });

    return this.authResponse(user);
  }

  async discordCallback(code: string) {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        redirect_uri: `${process.env.API_URL || "http://localhost:7000"}/api/auth/discord/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens: any = await tokenResponse.json();
    if (!tokens.access_token) throw new AppError(401, "Falha na autenticação com Discord");

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const discordUser: any = await userResponse.json();

    if (!discordUser.email) throw new AppError(400, "Discord não forneceu email");

    const user = await this.findOrLinkOAuthUser({
      provider: "discord",
      providerId: discordUser.id,
      email: normalizeEmail(discordUser.email),
    });

    return this.authResponse(user);
  }

  private async findOrLinkOAuthUser(params: {
    provider: OAuthProvider;
    providerId: string;
    email: string;
  }) {
    const { provider, providerId, email } = params;

    if (provider === "google") {
      const byGoogle = await prisma.user.findUnique({ where: { googleId: providerId } });
      if (byGoogle) return byGoogle;
    } else {
      const byDiscord = await prisma.user.findUnique({ where: { discordId: providerId } });
      if (byDiscord) return byDiscord;
    }

    const byEmail = await this.findUserByEmail(email);
    if (byEmail) {
      return this.linkProviderToUser(byEmail, params);
    }

    const createData =
      provider === "google"
        ? { email, nome: "", googleId: providerId, profileComplete: false }
        : { email, nome: "", discordId: providerId, profileComplete: false };

    try {
      return await prisma.user.create({ data: createData });
    } catch (err) {
      if (!isPrismaUniqueViolation(err)) throw err;

      const existing = await this.findUserByEmail(email);
      if (!existing) throw new AppError(409, "Email já cadastrado");

      return this.linkProviderToUser(existing, params);
    }
  }

  private linkProviderToUser(
    user: {
      id: number;
      email: string;
      nome: string;
      avatarUrl: string | null;
      avatarUpdatedAt: Date | null;
      profileComplete: boolean;
      googleId: string | null;
      discordId: string | null;
    },
    params: { provider: OAuthProvider; providerId: string }
  ) {
    const { provider, providerId } = params;

    if (provider === "google") {
      if (user.googleId && user.googleId !== providerId) {
        throw new AppError(409, "Este email já está vinculado a outra conta Google");
      }
      if (!user.googleId) {
        return prisma.user.update({
          where: { id: user.id },
          data: { googleId: providerId },
        });
      }
      return user;
    }

    if (user.discordId && user.discordId !== providerId) {
      throw new AppError(409, "Este email já está vinculado a outra conta Discord");
    }
    if (!user.discordId) {
      return prisma.user.update({
        where: { id: user.id },
        data: { discordId: providerId },
      });
    }
    return user;
  }
}
