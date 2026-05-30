-- AlterTable
ALTER TABLE "users" ADD COLUMN     "coins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalGames" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalTop3" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "missoes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "coinReward" INTEGER NOT NULL,
    "perGame" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "missoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_missoes" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "missionId" INTEGER NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "usuario_missoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loja_itens" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "icon" TEXT,
    "type" TEXT NOT NULL,
    "value" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "loja_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_itens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_partidas" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "patrimony" DOUBLE PRECISION NOT NULL,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_partidas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_missoes_userId_missionId_key" ON "usuario_missoes"("userId", "missionId");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_itens_userId_itemId_key" ON "usuario_itens"("userId", "itemId");

-- CreateIndex
CREATE INDEX "resultados_partidas_userId_idx" ON "resultados_partidas"("userId");

-- AddForeignKey
ALTER TABLE "usuario_missoes" ADD CONSTRAINT "usuario_missoes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_missoes" ADD CONSTRAINT "usuario_missoes_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_itens" ADD CONSTRAINT "usuario_itens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_itens" ADD CONSTRAINT "usuario_itens_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "loja_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_partidas" ADD CONSTRAINT "resultados_partidas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
