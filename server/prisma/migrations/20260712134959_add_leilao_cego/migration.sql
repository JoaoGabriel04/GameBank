-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "emLeilao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leilaoIniciadoEm" TIMESTAMP(3),
ADD COLUMN     "leilaoLanceMinimo" INTEGER,
ADD COLUMN     "leilaoPropId" INTEGER;

-- CreateTable
CREATE TABLE "leilao_lances" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "propId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "valor" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leilao_lances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leilao_lances_sessionId_propId_idx" ON "leilao_lances"("sessionId", "propId");

-- CreateIndex
CREATE UNIQUE INDEX "leilao_lances_sessionId_propId_playerId_key" ON "leilao_lances"("sessionId", "propId", "playerId");

-- AddForeignKey
ALTER TABLE "leilao_lances" ADD CONSTRAINT "leilao_lances_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leilao_lances" ADD CONSTRAINT "leilao_lances_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "session_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
