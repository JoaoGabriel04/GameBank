import { Worker, type Job } from "bullmq";
import { BauService } from "../modules/bau/bau.service.js";
import { logger } from "../lib/logger.js";
import { bullMQConnection } from "../lib/queues.js";

export type RecompensasBauJob = {
  sessionId: number;
  players: Array<{
    userId: number;
    position: number;
    teveRecompensa: boolean;
  }>;
};

const bauService = new BauService();

function createRecompensasWorker(connection = bullMQConnection) {
  const worker = new Worker<RecompensasBauJob>(
    "recompensas-partida",
    async (job: Job<RecompensasBauJob>) => {
      const { sessionId, players } = job.data;

      logger.info({ sessionId, qtdJogadores: players.length }, "processando baús pós-partida");

      for (const p of players) {
        if (!p.teveRecompensa) continue;
        if (p.position === 1) {
          await bauService.concederBauPartida(p.userId, "premium", undefined, 1);
        } else if (p.position === 2) {
          await bauService.concederBauPartida(p.userId, "comum", undefined, 2);
        }
      }

      logger.info({ sessionId }, "baús pós-partida concedidos com sucesso");
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, sessionId: job?.data?.sessionId, err },
      "falha ao conceder baús pós-partida"
    );
  });

  return worker;
}

export { createRecompensasWorker };
