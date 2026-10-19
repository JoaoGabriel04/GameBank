-- Visão limitada: 1 crédito por ciclo (VISAO_CREDITOS_MAX).
ALTER TABLE "session_players" ALTER COLUMN "creditoVisao" SET DEFAULT 1;

-- Partidas em andamento: quem tinha 2 créditos fica com 1.
-- creditoRecargaEm não muda.
UPDATE "session_players" SET "creditoVisao" = LEAST("creditoVisao", 1);
