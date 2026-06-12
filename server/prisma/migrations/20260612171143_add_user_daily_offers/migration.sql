-- CreateTable
CREATE TABLE "user_daily_offers" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "preco" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_daily_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_daily_offers_userId_itemId_expiresAt_key" ON "user_daily_offers"("userId", "itemId", "expiresAt");

-- AddForeignKey
ALTER TABLE "user_daily_offers" ADD CONSTRAINT "user_daily_offers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_daily_offers" ADD CONSTRAINT "user_daily_offers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "loja_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
