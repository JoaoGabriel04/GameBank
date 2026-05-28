import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/error-handler.middleware.js";

export class AuthService {
  async register(email: string, nome: string, senha: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, "Email já cadastrado");

    const passwordHash = await bcrypt.hash(senha, 12);
    const user = await prisma.user.create({
      data: { email, nome, passwordHash },
    });

    const token = signToken({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email, nome: user.nome } };
  }

  async login(email: string, senha: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new AppError(401, "Email ou senha inválidos");
    }

    const valida = await bcrypt.compare(senha, user.passwordHash);
    if (!valida) throw new AppError(401, "Email ou senha inválidos");

    const token = signToken({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email, nome: user.nome } };
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

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: googleUser.id }, { email: googleUser.email }] },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({ where: { id: user.id }, data: { googleId: googleUser.id, avatarUrl: googleUser.picture } });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          nome: googleUser.name,
          googleId: googleUser.id,
          avatarUrl: googleUser.picture,
        },
      });
    }

    const token = signToken({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email, nome: user.nome } };
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

    const email = discordUser.email;
    if (!email) throw new AppError(400, "Discord não forneceu email");

    let user = await prisma.user.findFirst({
      where: { OR: [{ discordId: discordUser.id }, { email }] },
    });

    if (user) {
      if (!user.discordId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { discordId: discordUser.id, avatarUrl: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          nome: discordUser.global_name || discordUser.username,
          discordId: discordUser.id,
          avatarUrl: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
        },
      });
    }

    const token = signToken({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email, nome: user.nome } };
  }
}
