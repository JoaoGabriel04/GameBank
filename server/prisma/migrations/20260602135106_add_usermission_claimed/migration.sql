-- AlterTable
ALTER TABLE "usuario_missoes" ADD COLUMN     "claimed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- Marca como já resgatadas missões concluídas antes desta mudança (evita duplicata de XP/coins)
UPDATE "usuario_missoes" SET "claimed" = true, "claimedAt" = "completedAt" WHERE "completed" = true;
