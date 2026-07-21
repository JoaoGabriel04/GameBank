import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../middleware/error-handler.middleware.js";
import { emitToRoom } from "../../../lib/socket.js";
import { mapa2dRepository } from "../mapa2d.repository.js";

class TerrenoMapa2DService {
  /**
   * Compra atômica — updateMany com WHERE condicional (donoId: null).
   * NUNCA "ler depois escrever" em dois passos (TOCTOU) — requisito de
   * segurança não-negociável do GDD Seção 9 / UML Seção 3.
   */
  async comprarTerreno(sessionId: number, playerId: number, terrenoId: number) {
    const player = await mapa2dRepository.findPlayer(playerId);
    if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado.");
    if (player.desistiu) throw new AppError(400, "Você não está mais na partida.");

    const sessionTerreno = await mapa2dRepository.findSessionTerreno(sessionId, terrenoId);
    if (!sessionTerreno) throw new AppError(404, "Terreno não encontrado nesta sessão.");
    if (sessionTerreno.donoId != null) throw new AppError(409, "Este terreno já foi comprado.");

    const preco = sessionTerreno.terreno.precoBase;
    if (player.saldo < preco) throw new AppError(400, "Saldo insuficiente.");

    // ATÔMICO — só afeta a linha se ainda não tiver dono.
    const resultado = await prisma.sessionTerreno.updateMany({
      where: { sessionId, terrenoId, donoId: null },
      data: { donoId: playerId, precoPago: preco, adquiridoEm: new Date() },
    });

    if (resultado.count === 0) {
      throw new AppError(409, "Este terreno já foi comprado.");
    }

    await mapa2dRepository.updatePlayerSaldo(playerId, -preco);

    await mapa2dRepository.criarHistorico(
      sessionId,
      "MAPA2D_COMPRA_TERRENO",
      `${player.nome} comprou ${sessionTerreno.terreno.codigo} por R$ ${preco}`
    );

    emitToRoom(sessionId, "mapa2d:terreno_comprado", { terrenoId, donoId: playerId, precoPago: preco });

    return { sucesso: true, precoPago: preco };
  }
}

export const terrenoMapa2DService = new TerrenoMapa2DService();
