/*
  Warnings:

  - You are about to drop the column `id_acao` on the `posses` table. All the data in the column will be lost.
  - You are about to drop the column `id_user` on the `posses` table. All the data in the column will be lost.
  - You are about to drop the `acoes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `sessionId` to the `historico` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo` to the `propriedades` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."posses" DROP CONSTRAINT "posses_id_acao_fkey";

-- DropForeignKey
ALTER TABLE "public"."posses" DROP CONSTRAINT "posses_id_user_fkey";

-- AlterTable
ALTER TABLE "historico" ADD COLUMN     "sessionId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "posses" DROP COLUMN "id_acao",
DROP COLUMN "id_user",
ALTER COLUMN "casas" SET DEFAULT 0,
ALTER COLUMN "hipotecada" SET DEFAULT false;

-- AlterTable
ALTER TABLE "propriedades" ADD COLUMN     "tipo" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."acoes";

-- DropTable
DROP TABLE "public"."users";

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "nome" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_players" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "saldo" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "session_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPosses" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "possesId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "casas" INTEGER NOT NULL DEFAULT 0,
    "hipotecada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionPosses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPosses" ADD CONSTRAINT "SessionPosses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPosses" ADD CONSTRAINT "SessionPosses_possesId_fkey" FOREIGN KEY ("possesId") REFERENCES "posses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPosses" ADD CONSTRAINT "SessionPosses_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "session_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico" ADD CONSTRAINT "historico_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
