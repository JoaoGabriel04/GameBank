import bcrypt from "bcryptjs";
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
import { authRepository } from "./auth.repository.js";

type OAuthProvider = "google" | "discord";

type AuthUser = {
  id: number;
  email: string;
  nome: string;
  avatarUrl: string | null;
  avatarUpdatedAt: Date | null;
  profileComplete: boolean;
  googleId?: string | null;
  discordId?: string | null;
};

export class AuthService {
  private async findUserByEmail(email: string): Promise<AuthUser | null> {
    const normalized = normalizeEmail(email);
    const exact = await authRepository.findByEmailExact(normalized);
    if (exact) return exact;

    const insensitive = await authRepository.findByEmailInsensitive(normalized);
    if (!insensitive) return null;
    if (insensitive.email === normalized) return insensitive;

    try {
      return await authRepository.updateEmail(insensitive.id, normalized);
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        return authRepository.findByEmailExact(normalized);
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
    isAdmin?: boolean;
  }) {
    const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin ?? false });
    return { token, user: toAuthUserPayload(user) };
  }

  async register(email: string, senha: string) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.findUserByEmail(normalizedEmail);
    if (existing) throw new AppError(409, "Email já cadastrado");

    const passwordHash = await bcrypt.hash(senha, 12);
    try {
      const user = await authRepository.create({
        email: normalizedEmail,
        nome: "",
        passwordHash,
        profileComplete: false,
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
    if (!user) throw new AppError(401, "Email ou senha inválidos");

    const full = await authRepository.findFullById(user.id);
    if (!full?.passwordHash) throw new AppError(401, "Email ou senha inválidos");

    const valida = await bcrypt.compare(senha, full.passwordHash);
    if (!valida) throw new AppError(401, "Email ou senha inválidos");

    return this.authResponse(user);
  }

  async completeProfile(
    userId: number,
    email: string,
    nome: string,
    options: { avatarPreset?: string; fileBuffer?: Buffer; fileMime?: string }
  ) {
    const current = await authRepository.findFullById(userId);

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

    const oldPublicId = current?.avatarPublicId ?? null;

    try {
      const user = await authRepository.upsertProfile(userId, email, {
        nome,
        avatarUrl: newAvatarUrl,
        avatarPublicId: newPublicId,
        avatarUpdatedAt: new Date(),
        profileComplete: true,
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
  }): Promise<AuthUser> {
    const { provider, providerId, email } = params;

    if (provider === "google") {
      const byGoogle = await authRepository.findByGoogleId(providerId);
      if (byGoogle) return byGoogle;
    } else {
      const byDiscord = await authRepository.findByDiscordId(providerId);
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
      return await authRepository.create(createData);
    } catch (err) {
      if (!isPrismaUniqueViolation(err)) throw err;

      const existing = await this.findUserByEmail(email);
      if (!existing) throw new AppError(409, "Email já cadastrado");

      return this.linkProviderToUser(existing, params);
    }
  }

  private async linkProviderToUser(
    user: AuthUser,
    params: { provider: OAuthProvider; providerId: string }
  ): Promise<AuthUser> {
    const { provider, providerId } = params;

    if (provider === "google") {
      if (user.googleId && user.googleId !== providerId) {
        throw new AppError(409, "Este email já está vinculado a outra conta Google");
      }
      if (!user.googleId) {
        return authRepository.linkGoogle(user.id, providerId);
      }
      return user;
    }

    if (user.discordId && user.discordId !== providerId) {
      throw new AppError(409, "Este email já está vinculado a outra conta Discord");
    }
    if (!user.discordId) {
      return authRepository.linkDiscord(user.id, providerId);
    }
    return user;
  }
}
