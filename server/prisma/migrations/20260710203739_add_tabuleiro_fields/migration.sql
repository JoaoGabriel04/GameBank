-- AlterTable
ALTER TABLE "session_players" ADD COLUMN     "dividaBanco" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emPrisao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "posicao" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pularProximaRodada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rodadasDevendo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tentativasPrisao" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "turnosPrisao" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "aguardandoAcao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ordemTurnos" TEXT,
ADD COLUMN     "turnoAtualPlayerId" INTEGER,
ADD COLUMN     "turnoIniciadoEm" TIMESTAMP(3),
ADD COLUMN     "ultimoDado1" INTEGER,
ADD COLUMN     "ultimoDado2" INTEGER;
