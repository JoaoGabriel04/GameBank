-- Adiciona contagem de propriedades e monopólios ao resultado de partida
ALTER TABLE "resultados_partidas" ADD COLUMN IF NOT EXISTS "propertiesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "resultados_partidas" ADD COLUMN IF NOT EXISTS "monopoliesCount" INTEGER NOT NULL DEFAULT 0;
