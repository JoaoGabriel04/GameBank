-- Índices em session_players
CREATE INDEX IF NOT EXISTS "session_players_userId_idx" ON "session_players"("userId");
CREATE INDEX IF NOT EXISTS "session_players_sessionId_idx" ON "session_players"("sessionId");

-- Renomeia tabela SessionPosses → session_posses (alinha com convenção do projeto)
ALTER TABLE IF EXISTS "SessionPosses" RENAME TO "session_posses";

-- Índices em session_posses
CREATE INDEX IF NOT EXISTS "session_posses_sessionId_idx" ON "session_posses"("sessionId");
CREATE INDEX IF NOT EXISTS "session_posses_playerId_idx" ON "session_posses"("playerId");
CREATE INDEX IF NOT EXISTS "session_posses_sessionId_playerId_idx" ON "session_posses"("sessionId", "playerId");

-- Índices em historico
CREATE INDEX IF NOT EXISTS "historico_sessionId_idx" ON "historico"("sessionId");

-- Índices em messages
CREATE INDEX IF NOT EXISTS "messages_sessionId_idx" ON "messages"("sessionId");

-- Índices em notifications
CREATE INDEX IF NOT EXISTS "notifications_sessionId_idx" ON "notifications"("sessionId");
CREATE INDEX IF NOT EXISTS "notifications_toPlayerId_idx" ON "notifications"("toPlayerId");

-- Campo expiresAt + índices em negociacoes
ALTER TABLE "negociacoes" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "negociacoes_sessionId_idx" ON "negociacoes"("sessionId");
CREATE INDEX IF NOT EXISTS "negociacoes_fromPlayerId_idx" ON "negociacoes"("fromPlayerId");
CREATE INDEX IF NOT EXISTS "negociacoes_toPlayerId_idx" ON "negociacoes"("toPlayerId");
CREATE INDEX IF NOT EXISTS "negociacoes_status_idx" ON "negociacoes"("status");

-- Índices em dividas
CREATE INDEX IF NOT EXISTS "dividas_playerId_idx" ON "dividas"("playerId");
CREATE INDEX IF NOT EXISTS "dividas_sessionId_idx" ON "dividas"("sessionId");

-- Índice adicional em resultados_partidas
CREATE INDEX IF NOT EXISTS "resultados_partidas_sessionId_idx" ON "resultados_partidas"("sessionId");
