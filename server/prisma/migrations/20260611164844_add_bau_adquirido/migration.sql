-- CreateTable
CREATE TABLE "baus_adquiridos" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bauId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "position" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'BLOQUEADO',
    "unlockAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baus_adquiridos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "baus_adquiridos_userId_idx" ON "baus_adquiridos"("userId");

-- AddForeignKey
ALTER TABLE "baus_adquiridos" ADD CONSTRAINT "baus_adquiridos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baus_adquiridos" ADD CONSTRAINT "baus_adquiridos_bauId_fkey" FOREIGN KEY ("bauId") REFERENCES "baus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
