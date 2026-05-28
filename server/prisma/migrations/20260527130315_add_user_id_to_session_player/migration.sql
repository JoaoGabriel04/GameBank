-- AlterTable
ALTER TABLE "session_players" ADD COLUMN     "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
