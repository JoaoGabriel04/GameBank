-- Crédito de Visão: revelação idempotente por rolagem.
ALTER TABLE "sessions" ADD COLUMN "dadosRevelados" BOOLEAN NOT NULL DEFAULT false;
