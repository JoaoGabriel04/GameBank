-- Fase 5: declara as FKs que eram apenas Int solto (sem integridade referencial).
-- Anula órfãos pré-existentes antes de criar as constraints.

-- 1) Anula sessionId órfão (apontando para sessões já deletadas) — colunas nuláveis
UPDATE "coin_transactions" c
SET "sessionId" = NULL
WHERE c."sessionId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "sessions" s WHERE s.id = c."sessionId");

UPDATE "baus_adquiridos" b
SET "sessionId" = NULL
WHERE b."sessionId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "sessions" s WHERE s.id = b."sessionId");

-- 2) Índices nas colunas de FK
CREATE INDEX "notifications_sessionPossesId_idx" ON "notifications"("sessionPossesId");
CREATE INDEX "negociacao_itens_sessionPossesId_idx" ON "negociacao_itens"("sessionPossesId");
CREATE INDEX "baus_adquiridos_sessionId_idx" ON "baus_adquiridos"("sessionId");
CREATE INDEX "coin_transactions_sessionId_idx" ON "coin_transactions"("sessionId");
CREATE INDEX "diamond_transactions_itemId_idx" ON "diamond_transactions"("itemId");

-- 3) Constraints de FK
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_sessionPossesId_fkey"
  FOREIGN KEY ("sessionPossesId") REFERENCES "session_posses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "negociacao_itens"
  ADD CONSTRAINT "negociacao_itens_sessionPossesId_fkey"
  FOREIGN KEY ("sessionPossesId") REFERENCES "session_posses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "baus_adquiridos"
  ADD CONSTRAINT "baus_adquiridos_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "coin_transactions"
  ADD CONSTRAINT "coin_transactions_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "diamond_transactions"
  ADD CONSTRAINT "diamond_transactions_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "loja_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
