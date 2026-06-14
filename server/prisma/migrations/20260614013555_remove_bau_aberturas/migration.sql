/*
  Warnings:

  - You are about to drop the `bau_abertura_itens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bau_aberturas` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bau_abertura_itens" DROP CONSTRAINT "bau_abertura_itens_aberturaId_fkey";

-- DropForeignKey
ALTER TABLE "bau_abertura_itens" DROP CONSTRAINT "bau_abertura_itens_itemId_fkey";

-- DropForeignKey
ALTER TABLE "bau_aberturas" DROP CONSTRAINT "bau_aberturas_bauId_fkey";

-- DropForeignKey
ALTER TABLE "bau_aberturas" DROP CONSTRAINT "bau_aberturas_userId_fkey";

-- DropTable
DROP TABLE "bau_abertura_itens";

-- DropTable
DROP TABLE "bau_aberturas";
