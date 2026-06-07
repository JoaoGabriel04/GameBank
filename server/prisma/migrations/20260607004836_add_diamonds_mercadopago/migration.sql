-- AlterTable
ALTER TABLE "diamond_transactions" ADD COLUMN     "note" TEXT,
ADD COLUMN     "purchaseId" TEXT;

-- AlterTable
ALTER TABLE "loja_itens" ADD COLUMN     "diamondPrice" INTEGER;

-- CreateTable
CREATE TABLE "diamond_packages" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "diamonds" INTEGER NOT NULL,
    "bonusPct" INTEGER NOT NULL DEFAULT 0,
    "priceInCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diamond_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diamond_purchases" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "packageId" INTEGER NOT NULL,
    "diamondsGranted" INTEGER NOT NULL,
    "amountPaidCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "mpPaymentId" TEXT,
    "mpPreferenceId" TEXT,
    "mpIdempotencyKey" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "diamond_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diamond_purchases_mpPaymentId_key" ON "diamond_purchases"("mpPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "diamond_purchases_mpIdempotencyKey_key" ON "diamond_purchases"("mpIdempotencyKey");

-- CreateIndex
CREATE INDEX "diamond_purchases_userId_idx" ON "diamond_purchases"("userId");

-- CreateIndex
CREATE INDEX "diamond_purchases_status_idx" ON "diamond_purchases"("status");

-- AddForeignKey
ALTER TABLE "diamond_transactions" ADD CONSTRAINT "diamond_transactions_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "diamond_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diamond_purchases" ADD CONSTRAINT "diamond_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diamond_purchases" ADD CONSTRAINT "diamond_purchases_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "diamond_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
