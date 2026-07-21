-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "inflacaoAcumuladaMapa2D" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "emprestimos_mapa2d" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "valorOriginal" INTEGER NOT NULL,
    "valorDevido" INTEGER NOT NULL,
    "garantiaSessionTerrenoId" INTEGER NOT NULL,
    "quitado" BOOLEAN NOT NULL DEFAULT false,
    "executado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quitadoEm" TIMESTAMP(3),

    CONSTRAINT "emprestimos_mapa2d_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emprestimos_mapa2d_garantiaSessionTerrenoId_key" ON "emprestimos_mapa2d"("garantiaSessionTerrenoId");

-- CreateIndex
CREATE INDEX "emprestimos_mapa2d_sessionId_playerId_idx" ON "emprestimos_mapa2d"("sessionId", "playerId");

-- AddForeignKey
ALTER TABLE "emprestimos_mapa2d" ADD CONSTRAINT "emprestimos_mapa2d_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimos_mapa2d" ADD CONSTRAINT "emprestimos_mapa2d_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "session_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimos_mapa2d" ADD CONSTRAINT "emprestimos_mapa2d_garantiaSessionTerrenoId_fkey" FOREIGN KEY ("garantiaSessionTerrenoId") REFERENCES "session_terrenos_mapa2d"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
