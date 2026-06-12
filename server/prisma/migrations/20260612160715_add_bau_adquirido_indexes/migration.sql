-- CreateIndex
CREATE INDEX "baus_adquiridos_userId_status_idx" ON "baus_adquiridos"("userId", "status");

-- CreateIndex
CREATE INDEX "baus_adquiridos_userId_unlockAt_idx" ON "baus_adquiridos"("userId", "unlockAt");
