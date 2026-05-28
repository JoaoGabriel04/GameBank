-- CreateTable
CREATE TABLE "dividas" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "descricao" TEXT NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "dividas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "dividas" ADD CONSTRAINT "dividas_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividas" ADD CONSTRAINT "dividas_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "session_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
