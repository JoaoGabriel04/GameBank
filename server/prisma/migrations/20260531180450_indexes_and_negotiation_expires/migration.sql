-- AlterTable
ALTER TABLE "session_posses" RENAME CONSTRAINT "SessionPosses_pkey" TO "session_posses_pkey";

-- RenameForeignKey
ALTER TABLE "session_posses" RENAME CONSTRAINT "SessionPosses_lastOwnerId_fkey" TO "session_posses_lastOwnerId_fkey";

-- RenameForeignKey
ALTER TABLE "session_posses" RENAME CONSTRAINT "SessionPosses_playerId_fkey" TO "session_posses_playerId_fkey";

-- RenameForeignKey
ALTER TABLE "session_posses" RENAME CONSTRAINT "SessionPosses_possesId_fkey" TO "session_posses_possesId_fkey";

-- RenameForeignKey
ALTER TABLE "session_posses" RENAME CONSTRAINT "SessionPosses_sessionId_fkey" TO "session_posses_sessionId_fkey";
