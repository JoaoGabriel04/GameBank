import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) return;

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.upsert({
      where: { email },
      update: { isAdmin: true, passwordHash },
      create: {
        email,
        nome: "Admin",
        passwordHash,
        isAdmin: true,
        profileComplete: true,
      },
    });
    logger.info({ email: admin.email, id: admin.id }, "seed admin garantido");
  } catch (err) {
    logger.error({ err }, "seed falha ao garantir admin");
  }

  // Garante que o item "Padrão" (id=0, banner virtual) existe na loja_itens
  try {
    await prisma.shopItem.upsert({
      where: { id: 0 },
      update: {},
      create: {
        id: 0,
        name: "Padrão",
        price: 0,
        type: "banner",
        available: false,
      },
    });
    logger.info("seed ShopItem id=0 (Padrão) garantido");
  } catch (err) {
    logger.error({ err }, "seed falha ao garantir ShopItem id=0");
  }
}
