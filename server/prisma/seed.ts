import { PrismaClient } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("[seed] ADMIN_EMAIL ou ADMIN_PASSWORD não definidos — pulando seed de admin.");
    return;
  }

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

  console.log(`[seed] Admin garantido: ${admin.email} (id=${admin.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
