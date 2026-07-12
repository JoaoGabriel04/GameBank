import { UserRepository } from "./user.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { prisma } from "../../lib/prisma.js";

export class UserService {
  constructor(private repo = new UserRepository()) {}

  async getPlayerById(playerId: number) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "Jogador não encontrado");
    return player;
  }

  async editPlayer(playerId: number, nome: string, cor: string) {
    return this.repo.update(playerId, { nome, cor });
  }

  async removePlayer(playerId: number, requesterUserId: number) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "Jogador não encontrado");

    const session = await prisma.session.findUnique({
      where: { id: player.sessionId },
    });
    if (!session) throw new AppError(404, "Sessão não encontrada");

    if (session.ownerId !== requesterUserId) {
      throw new AppError(403, "Apenas o criador da sala pode remover jogadores");
    }

    await prisma.$transaction(async (tx) => {
      // Inclui propriedades hipotecadas por este jogador (playerId já nulo
      // desde a hipoteca, só rastreadas por lastOwnerId) — além de devolver
      // ao banco corretamente (sem ficar hipotecada presa a ninguém), evita
      // que o delete abaixo quebre por causa da referência de lastOwnerId.
      await tx.sessionPosses.updateMany({
        where: { OR: [{ playerId }, { lastOwnerId: playerId }] },
        data: { playerId: null, lastOwnerId: null, casas: 0, hipotecada: false, negociando: false },
      });
      await tx.sessionPlayer.delete({ where: { id: playerId } });
    });

    return { playerId, sessionId: session.id };
  }
}
