-- Terreno ocioso: rodada da última atividade em cada posse.
ALTER TABLE "session_posses" ADD COLUMN "ultimaAtividadeRodada" INTEGER NOT NULL DEFAULT 0;

-- Backfill: partidas em andamento começam a contar a partir da rodada
-- atual, sem cobrança retroativa.
UPDATE "session_posses" sp
SET "ultimaAtividadeRodada" = s."rodadaAtual"
FROM "sessions" s
WHERE s.id = sp."sessionId";
