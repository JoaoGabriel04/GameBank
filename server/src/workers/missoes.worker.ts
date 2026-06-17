import { Worker, type Job } from "bullmq";
import { MissionsService } from "../modules/missions/missions.service.js";
import { logger } from "../lib/logger.js";
import { bullMQConnection } from "../lib/queues.js";

export type MissoesJob = {
  sessionId: number;
  players: Array<{
    userId: number;
    position: number;
  }>;
};

const missionService = new MissionsService();

function createMissoesWorker(connection = bullMQConnection) {
  const worker = new Worker<MissoesJob>(
    "progresso-missoes",
    async (job: Job<MissoesJob>) => {
      const { sessionId, players } = job.data;

      logger.info({ sessionId, qtdJogadores: players.length }, "processando missões pós-partida");

      for (const p of players) {
        await missionService.track(p.userId, "games_played", 1);
        if (p.position === 1) await missionService.track(p.userId, "wins", 1);
        if (p.position <= 3) await missionService.track(p.userId, "top3", 1);
      }

      logger.info({ sessionId }, "missões pós-partida atualizadas com sucesso");
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, sessionId: job?.data?.sessionId, err },
      "falha ao atualizar missões pós-partida"
    );
  });

  return worker;
}

export { createMissoesWorker };
