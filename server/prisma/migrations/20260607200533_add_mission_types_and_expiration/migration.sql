-- AlterTable
ALTER TABLE "missoes" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'permanent';

-- AlterTable
ALTER TABLE "usuario_missoes" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
