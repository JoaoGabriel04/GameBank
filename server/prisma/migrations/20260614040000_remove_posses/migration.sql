-- Fase 3: elimina a tabela `posses` (espelho 1:1 de propriedades).
-- SessionPosses passa a referenciar Propriedade diretamente via propId.
-- Escrita à mão para preservar dados existentes (backfill possesId -> id_prop).

-- 1) Nova coluna propId (nullable para permitir o backfill)
ALTER TABLE "session_posses" ADD COLUMN "propId" INTEGER;

-- 2) Backfill: traduz possesId -> id_prop da posses correspondente
--    (no-op se session_posses estiver vazia)
UPDATE "session_posses" sp
SET "propId" = p."id_prop"
FROM "posses" p
WHERE sp."possesId" = p."id";

-- 3) Agora a coluna pode ser obrigatória
ALTER TABLE "session_posses" ALTER COLUMN "propId" SET NOT NULL;

-- 4) Remove FK, índice e coluna antigos (possesId -> posses)
ALTER TABLE "session_posses" DROP CONSTRAINT "session_posses_possesId_fkey";
DROP INDEX "session_posses_possesId_idx";
ALTER TABLE "session_posses" DROP COLUMN "possesId";

-- 5) Nova FK propId -> propriedades + índice
ALTER TABLE "session_posses"
  ADD CONSTRAINT "session_posses_propId_fkey"
  FOREIGN KEY ("propId") REFERENCES "propriedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "session_posses_propId_idx" ON "session_posses"("propId");

-- 6) Remove a tabela posses
ALTER TABLE "posses" DROP CONSTRAINT "posses_id_prop_fkey";
DROP TABLE "posses";
