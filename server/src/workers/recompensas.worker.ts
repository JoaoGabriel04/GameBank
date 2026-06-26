import { Worker, type Job } from "bullmq";
import { BauService } from "../modules/bau/bau.service.js";
import { logger } from "../lib/logger.js";
import { bullMQConnection } from "../lib/queues.js";
import { emitToUser } from "../lib/socket.js";

export type RecompensasBauJob = {
  sessionId: number;
  players: Array<{
    userId: number;
    position: number;
    teveRecompensa: boolean;
    gameResultId?: number;
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
        const tipo = p.position === 1 ? "premium" : p.position === 2 ? "comum" : null;
        if (!tipo) continue;
        // sessionId não é passado aqui — a sessão já foi deletada antes do worker rodar
        const bau = await bauService.concederBauPartida(p.userId, tipo, undefined, p.position, p.gameResultId);
        if (!bau) {
          logger.warn({ userId: p.userId, sessionId, tipo }, "baú pós-partida não concedido (cap diário ou tipo inválido)");
        } else {
          await emitToUser(p.userId, "bau:recebido", { tipo, bauId: bau.id }).catch(() => {});
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
