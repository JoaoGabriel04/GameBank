-- CreateTable
CREATE TABLE IF NOT EXISTS "frames" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "css" TEXT,
    "animated" BOOLEAN NOT NULL DEFAULT false,
    "disponibilidade" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "frames_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "frame" TEXT,
ADD COLUMN IF NOT EXISTS frametype TEXT,
ADD COLUMN IF NOT EXISTS frameanimated BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "frameScale" INTEGER NOT NULL DEFAULT 136;

-- AlterTable
ALTER TABLE "loja_itens" ADD COLUMN IF NOT EXISTS "frameId" INTEGER;

-- AddForeignKey
ALTER TABLE "loja_itens" ADD CONSTRAINT "loja_itens_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "frames"("id") ON DELETE SET NULL ON UPDATE CASCADE;
