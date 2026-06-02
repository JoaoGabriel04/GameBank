-- AlterTable
ALTER TABLE "loja_itens" ADD COLUMN     "bannerId" INTEGER;

-- AddForeignKey
ALTER TABLE "loja_itens" ADD CONSTRAINT "loja_itens_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "banners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
