/*
  Warnings:

  - You are about to drop the column `createdAt` on the `frames` table. All the data in the column will be lost.
  - You are about to drop the column `imagePublicId` on the `frames` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `frames` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_fragments" DROP CONSTRAINT "user_fragments_itemId_fkey";

-- DropForeignKey
ALTER TABLE "user_fragments" DROP CONSTRAINT "user_fragments_userId_fkey";

-- DropIndex
DROP INDEX "user_fragments_itemId_idx";

-- DropIndex
DROP INDEX "user_fragments_userId_idx";

-- AlterTable
ALTER TABLE "frames" DROP COLUMN "createdAt",
DROP COLUMN "imagePublicId",
DROP COLUMN "imageUrl",
ADD COLUMN     "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "imagepublicid" TEXT,
ADD COLUMN     "imageurl" TEXT,
ADD COLUMN     "scale" INTEGER NOT NULL DEFAULT 136,
ALTER COLUMN "tipo" SET DEFAULT 'gradient';

-- AlterTable
ALTER TABLE "user_fragments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "baus" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "precoCoins" INTEGER,
    "precoDiamonds" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "baus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bau_aberturas" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bauId" INTEGER NOT NULL,
    "coinsGanhos" INTEGER NOT NULL DEFAULT 0,
    "custoPago" TEXT NOT NULL,
    "valorPago" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bau_aberturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bau_abertura_itens" (
    "id" SERIAL NOT NULL,
    "aberturaId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "raridade" TEXT NOT NULL,
    "fragmentos" INTEGER NOT NULL,

    CONSTRAINT "bau_abertura_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "baus_tipo_key" ON "baus"("tipo");

-- AddForeignKey
ALTER TABLE "user_fragments" ADD CONSTRAINT "user_fragments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_fragments" ADD CONSTRAINT "user_fragments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "loja_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bau_aberturas" ADD CONSTRAINT "bau_aberturas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bau_aberturas" ADD CONSTRAINT "bau_aberturas_bauId_fkey" FOREIGN KEY ("bauId") REFERENCES "baus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bau_abertura_itens" ADD CONSTRAINT "bau_abertura_itens_aberturaId_fkey" FOREIGN KEY ("aberturaId") REFERENCES "bau_aberturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bau_abertura_itens" ADD CONSTRAINT "bau_abertura_itens_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "loja_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
