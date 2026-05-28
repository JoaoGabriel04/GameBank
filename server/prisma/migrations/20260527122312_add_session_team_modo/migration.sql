-- AlterTable
ALTER TABLE "session_players" ADD COLUMN     "teamId" INTEGER;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "modo" TEXT NOT NULL DEFAULT 'individual';

-- CreateTable
CREATE TABLE "session_teams" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "saldo" DOUBLE PRECISION NOT NULL DEFAULT 25000,

    CONSTRAINT "session_teams_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "session_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_teams" ADD CONSTRAINT "session_teams_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
