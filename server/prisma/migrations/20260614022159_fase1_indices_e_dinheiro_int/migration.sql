/*
  Warnings:

  - You are about to alter the column `valor` on the `dividas` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `valor` on the `negociacao_itens` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `patrimony` on the `resultados_partidas` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `saldo` on the `session_players` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `patrimonyAtDesistir` on the `session_players` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `saldo` on the `session_teams` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `saldoInicial` on the `sessions` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "dividas" ALTER COLUMN "valor" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "negociacao_itens" ALTER COLUMN "valor" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "resultados_partidas" ALTER COLUMN "patrimony" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "session_players" ALTER COLUMN "saldo" SET DATA TYPE INTEGER,
ALTER COLUMN "patrimonyAtDesistir" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "session_teams" ALTER COLUMN "saldo" SET DEFAULT 25000,
ALTER COLUMN "saldo" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "saldoInicial" SET DEFAULT 25000,
ALTER COLUMN "saldoInicial" SET DATA TYPE INTEGER;

-- CreateIndex
CREATE INDEX "diamond_transactions_purchaseId_idx" ON "diamond_transactions"("purchaseId");

-- CreateIndex
CREATE INDEX "loja_itens_bannerId_idx" ON "loja_itens"("bannerId");

-- CreateIndex
CREATE INDEX "loja_itens_frameId_idx" ON "loja_itens"("frameId");

-- CreateIndex
CREATE INDEX "loja_itens_badgeId_idx" ON "loja_itens"("badgeId");

-- CreateIndex
CREATE INDEX "messages_playerId_idx" ON "messages"("playerId");

-- CreateIndex
CREATE INDEX "session_players_teamId_idx" ON "session_players"("teamId");

-- CreateIndex
CREATE INDEX "session_posses_possesId_idx" ON "session_posses"("possesId");

-- CreateIndex
CREATE INDEX "session_posses_lastOwnerId_idx" ON "session_posses"("lastOwnerId");

-- CreateIndex
CREATE INDEX "sessions_ownerId_idx" ON "sessions"("ownerId");
