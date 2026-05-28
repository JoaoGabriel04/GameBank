import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../../generated/prisma/index.js";

export class UserRepository {
  async findById(id: number) {
    return prisma.sessionPlayer.findUnique({
      where: { id },
      include: { sessionPosses: true },
    });
  }

  async update(id: number, data: Prisma.SessionPlayerUpdateInput) {
    return prisma.sessionPlayer.update({ where: { id }, data });
  }

  async delete(id: number) {
    return prisma.sessionPlayer.delete({
      where: { id },
      include: { session: true, sessionPosses: true },
    });
  }

  async removePlayerFromPosses(playerId: number) {
    return prisma.sessionPosses.updateMany({
      where: { playerId },
      data: { playerId: null, casas: 0 },
    });
  }
}
