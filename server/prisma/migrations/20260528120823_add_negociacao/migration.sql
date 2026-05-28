-- AlterTable
ALTER TABLE "SessionPosses" ADD COLUMN     "negociando" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "negociacoes" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "fromPlayerId" INTEGER NOT NULL,
    "toPlayerId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "negociacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negociacao_itens" (
    "id" SERIAL NOT NULL,
    "negotiationId" INTEGER NOT NULL,
    "sessionPossesId" INTEGER,
    "fromSide" BOOLEAN NOT NULL,
    "valor" DOUBLE PRECISION,

    CONSTRAINT "negociacao_itens_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "negociacoes" ADD CONSTRAINT "negociacoes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negociacoes" ADD CONSTRAINT "negociacoes_fromPlayerId_fkey" FOREIGN KEY ("fromPlayerId") REFERENCES "session_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negociacoes" ADD CONSTRAINT "negociacoes_toPlayerId_fkey" FOREIGN KEY ("toPlayerId") REFERENCES "session_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negociacao_itens" ADD CONSTRAINT "negociacao_itens_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "negociacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
