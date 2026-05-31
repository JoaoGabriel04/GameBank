import { prisma } from "../../lib/prisma.js";

export const authRepository = {
  findByEmailExact: (email: string) =>
    prisma.user.findUnique({ where: { email } }),

  findByEmailInsensitive: (email: string) =>
    prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    }),

  updateEmail: (id: number, email: string) =>
    prisma.user.update({ where: { id }, data: { email } }),

  create: (data: {
    email: string;
    nome: string;
    passwordHash?: string;
    profileComplete: boolean;
    googleId?: string;
    discordId?: string;
  }) => prisma.user.create({ data }),

  findByGoogleId: (googleId: string) =>
    prisma.user.findUnique({ where: { googleId } }),

  findByDiscordId: (discordId: string) =>
    prisma.user.findUnique({ where: { discordId } }),

  findById: (id: number) =>
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nome: true,
        avatarUrl: true,
        avatarUpdatedAt: true,
        profileComplete: true,
        isAdmin: true,
      },
    }),

  findFullById: (id: number) =>
    prisma.user.findUnique({ where: { id } }),

  linkGoogle: (id: number, googleId: string) =>
    prisma.user.update({ where: { id }, data: { googleId } }),

  linkDiscord: (id: number, discordId: string) =>
    prisma.user.update({ where: { id }, data: { discordId } }),

  upsertProfile: (
    id: number,
    email: string,
    data: Record<string, unknown>
  ) =>
    prisma.user.upsert({
      where: { id },
      create: { id, email, nome: "", profileComplete: false, ...data } as Parameters<typeof prisma.user.upsert>[0]["create"],
      update: data,
    }),
};
