-- CreateTable
CREATE TABLE "emprestimos" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "valorOriginal" INTEGER NOT NULL,
    "valorDevido" INTEGER NOT NULL,
    "garantiaPropId" INTEGER NOT NULL,
    "quitado" BOOLEAN NOT NULL DEFAULT false,
    "executado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quitadoEm" TIMESTAMP(3),

    CONSTRAINT "emprestimos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emprestimos_sessionId_playerId_idx" ON "emprestimos"("sessionId", "playerId");

-- CreateIndex
CREATE INDEX "emprestimos_playerId_quitado_idx" ON "emprestimos"("playerId", "quitado");

-- AddForeignKey
ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "session_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
