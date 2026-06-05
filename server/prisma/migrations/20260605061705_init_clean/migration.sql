-- CreateTable
CREATE TABLE "propriedades" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo_cor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "custo_compra" INTEGER NOT NULL,
    "aluguel_base" INTEGER NOT NULL,
    "aluguel_1c" INTEGER NOT NULL,
    "aluguel_2c" INTEGER NOT NULL,
    "aluguel_3c" INTEGER NOT NULL,
    "aluguel_4c" INTEGER NOT NULL,
    "aluguel_hotel" INTEGER NOT NULL,
    "custo_casa" INTEGER NOT NULL,
    "hipoteca" INTEGER NOT NULL,

    CONSTRAINT "propriedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "nome" TEXT NOT NULL,
    "googleId" TEXT,
    "discordId" TEXT,
    "avatarUrl" TEXT,
    "avatarPublicId" TEXT,
    "avatarUpdatedAt" TIMESTAMP(3),
    "banner" TEXT,
    "spriteId" TEXT,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalTop3" INTEGER NOT NULL DEFAULT 0,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "banReason" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "nome" TEXT,
    "senha" TEXT,
    "modo" TEXT NOT NULL DEFAULT 'individual',
    "status" TEXT NOT NULL DEFAULT 'Esperando',
    "maxJogadores" INTEGER NOT NULL DEFAULT 6,
    "saldoInicial" DOUBLE PRECISION NOT NULL DEFAULT 25000,
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" INTEGER,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_players" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "userId" INTEGER,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "saldo" DOUBLE PRECISION NOT NULL,
    "teamId" INTEGER,
    "carta_prisao" BOOLEAN NOT NULL DEFAULT false,
    "desistiu" BOOLEAN NOT NULL DEFAULT false,
    "patrimonyAtDesistir" DOUBLE PRECISION,

    CONSTRAINT "session_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_teams" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "saldo" DOUBLE PRECISION NOT NULL DEFAULT 25000,

    CONSTRAINT "session_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posses" (
    "id" SERIAL NOT NULL,
    "id_prop" INTEGER NOT NULL,
    "casas" INTEGER NOT NULL DEFAULT 0,
    "hipotecada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "posses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_posses" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "possesId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "lastOwnerId" INTEGER,
    "casas" INTEGER NOT NULL DEFAULT 0,
    "hipotecada" BOOLEAN NOT NULL DEFAULT false,
    "negociando" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "session_posses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalhes" TEXT NOT NULL,

    CONSTRAINT "historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "fromPlayerId" INTEGER NOT NULL,
    "toPlayerId" INTEGER NOT NULL,
    "sessionPossesId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negociacoes" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "fromPlayerId" INTEGER NOT NULL,
    "toPlayerId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "negociacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negociacao_itens" (
    "id" SERIAL NOT NULL,
    "negotiationId" INTEGER NOT NULL,
    "sessionPossesId" INTEGER,
    "fromSide" BOOLEAN NOT NULL,
    "valor" DOUBLE PRECISION,

    CONSTRAINT "negociacao_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividas" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "descricao" TEXT NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "dividas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missoes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "coinReward" INTEGER NOT NULL,
    "perGame" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "missoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_missoes" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "missionId" INTEGER NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "usuario_missoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loja_itens" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "icon" TEXT,
    "type" TEXT NOT NULL,
    "value" TEXT,
    "rarity" TEXT,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "bannerId" INTEGER,

    CONSTRAINT "loja_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_partidas" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "patrimony" DOUBLE PRECISION NOT NULL,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_partidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cartas" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "efeito" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cartas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jogo_configuracoes" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jogo_configuracoes_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "css" TEXT NOT NULL,
    "spriteId" TEXT,
    "imagePublicId" TEXT,
    "imageUpdatedAt" TIMESTAMP(3),
    "disponibilidade" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" JSONB,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- CreateIndex
CREATE INDEX "session_players_userId_idx" ON "session_players"("userId");

-- CreateIndex
CREATE INDEX "session_players_sessionId_idx" ON "session_players"("sessionId");

-- CreateIndex
CREATE INDEX "session_posses_sessionId_idx" ON "session_posses"("sessionId");

-- CreateIndex
CREATE INDEX "session_posses_playerId_idx" ON "session_posses"("playerId");

-- CreateIndex
CREATE INDEX "session_posses_sessionId_playerId_idx" ON "session_posses"("sessionId", "playerId");

-- CreateIndex
CREATE INDEX "historico_sessionId_idx" ON "historico"("sessionId");

-- CreateIndex
CREATE INDEX "messages_sessionId_idx" ON "messages"("sessionId");

-- CreateIndex
CREATE INDEX "notifications_sessionId_idx" ON "notifications"("sessionId");

-- CreateIndex
CREATE INDEX "notifications_toPlayerId_idx" ON "notifications"("toPlayerId");

-- CreateIndex
CREATE INDEX "negociacoes_sessionId_idx" ON "negociacoes"("sessionId");

-- CreateIndex
CREATE INDEX "negociacoes_fromPlayerId_idx" ON "negociacoes"("fromPlayerId");

-- CreateIndex
CREATE INDEX "negociacoes_toPlayerId_idx" ON "negociacoes"("toPlayerId");

-- CreateIndex
CREATE INDEX "negociacoes_status_idx" ON "negociacoes"("status");

-- CreateIndex
CREATE INDEX "dividas_playerId_idx" ON "dividas"("playerId");

-- CreateIndex
CREATE INDEX "dividas_sessionId_idx" ON "dividas"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_missoes_userId_missionId_key" ON "usuario_missoes"("userId", "missionId");

-- CreateIndex
CREATE INDEX "resultados_partidas_userId_idx" ON "resultados_partidas"("userId");

-- CreateIndex
CREATE INDEX "resultados_partidas_sessionId_idx" ON "resultados_partidas"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "jogo_configuracoes_key_key" ON "jogo_configuracoes"("key");

-- CreateIndex
CREATE INDEX "user_notifications_userId_idx" ON "user_notifications"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "session_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_teams" ADD CONSTRAINT "session_teams_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posses" ADD CONSTRAINT "posses_id_prop_fkey" FOREIGN KEY ("id_prop") REFERENCES "propriedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_posses" ADD CONSTRAINT "session_posses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_posses" ADD CONSTRAINT "session_posses_possesId_fkey" FOREIGN KEY ("possesId") REFERENCES "posses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_posses" ADD CONSTRAINT "session_posses_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "session_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_posses" ADD CONSTRAINT "session_posses_lastOwnerId_fkey" FOREIGN KEY ("lastOwnerId") REFERENCES "session_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico" ADD CONSTRAINT "historico_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "session_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_fromPlayerId_fkey" FOREIGN KEY ("fromPlayerId") REFERENCES "session_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_toPlayerId_fkey" FOREIGN KEY ("toPlayerId") REFERENCES "session_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negociacoes" ADD CONSTRAINT "negociacoes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negociacoes" ADD CONSTRAINT "negociacoes_fromPlayerId_fkey" FOREIGN KEY ("fromPlayerId") REFERENCES "session_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negociacoes" ADD CONSTRAINT "negociacoes_toPlayerId_fkey" FOREIGN KEY ("toPlayerId") REFERENCES "session_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negociacao_itens" ADD CONSTRAINT "negociacao_itens_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "negociacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividas" ADD CONSTRAINT "dividas_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividas" ADD CONSTRAINT "dividas_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "session_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_missoes" ADD CONSTRAINT "usuario_missoes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_missoes" ADD CONSTRAINT "usuario_missoes_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loja_itens" ADD CONSTRAINT "loja_itens_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "banners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_partidas" ADD CONSTRAINT "resultados_partidas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
