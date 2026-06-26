-- Vincula BauAdquirido ao GameResult para exibir baú no histórico de partidas
ALTER TABLE "baus_adquiridos" ADD COLUMN IF NOT EXISTS "gameResultId" INTEGER;
ALTER TABLE "baus_adquiridos"
  ADD CONSTRAINT "baus_adquiridos_gameResultId_fkey"
  FOREIGN KEY ("gameResultId") REFERENCES "resultados_partidas"("id") ON DELETE SET NULL;
