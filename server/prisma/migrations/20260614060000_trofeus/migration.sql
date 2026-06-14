-- Adiciona trophies ao User
ALTER TABLE "users" ADD COLUMN "trophies" INTEGER NOT NULL DEFAULT 0;

-- Adiciona campos de troféu ao GameResult
ALTER TABLE "resultados_partidas"
  ADD COLUMN "trophyDelta"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trophyBefore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trophyAfter"  INTEGER NOT NULL DEFAULT 0;

-- Adiciona distinção voluntária vs falência ao SessionPlayer
ALTER TABLE "session_players"
  ADD COLUMN "motivoDesistencia" TEXT,
  ADD COLUMN "desistiuEm"        TIMESTAMPTZ;
