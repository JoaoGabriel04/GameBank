-- AlterTable
ALTER TABLE "users" ADD COLUMN     "diamonds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "diamond_transactions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "itemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diamond_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diamond_transactions_paymentIntentId_key" ON "diamond_transactions"("paymentIntentId");

-- CreateIndex
CREATE INDEX "diamond_transactions_userId_idx" ON "diamond_transactions"("userId");

-- AddForeignKey
ALTER TABLE "diamond_transactions" ADD CONSTRAINT "diamond_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
