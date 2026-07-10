-- CreateEnum
CREATE TYPE "TipoJogo" AS ENUM ('banca', 'tabuleiro');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "tipoJogo" "TipoJogo" NOT NULL DEFAULT 'banca';
