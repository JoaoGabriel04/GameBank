-- CreateTable: badges
CREATE TABLE IF NOT EXISTS "badges" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "disponibilidade" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add badgeId to loja_itens
ALTER TABLE "loja_itens" ADD COLUMN IF NOT EXISTS "badgeId" INTEGER;

-- AddForeignKey
ALTER TABLE "loja_itens" ADD CONSTRAINT "loja_itens_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
