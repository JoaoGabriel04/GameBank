-- DropForeignKey
ALTER TABLE "baus_adquiridos" DROP CONSTRAINT "baus_adquiridos_gameResultId_fkey";

-- AddForeignKey
ALTER TABLE "baus_adquiridos" ADD CONSTRAINT "baus_adquiridos_gameResultId_fkey" FOREIGN KEY ("gameResultId") REFERENCES "resultados_partidas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
