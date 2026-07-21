import { Prisma, type TipoConstrucao } from "../../../../generated/prisma/index.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../middleware/error-handler.middleware.js";
import { emitToRoom } from "../../../lib/socket.js";
import { mapa2dRepository } from "../mapa2d.repository.js";
import { CUSTO_POR_SLOT, SLOTS_CONSTRUCAO } from "../../../constants/economiaMapa2D.js";
import { economiaMapa2DService } from "./economia.service.js";

const TIPOS_VALIDOS = Object.keys(SLOTS_CONSTRUCAO) as TipoConstrucao[];

class ConstrucaoMapa2DService {
  /** 1 construção por terreno, sempre nível 1 nesta fatia (sem sistema de slots ainda). */
  async construir(sessionId: number, playerId: number, sessionTerrenoId: number, tipo: TipoConstrucao) {
    if (!TIPOS_VALIDOS.includes(tipo)) throw new AppError(400, "Tipo de construção inválido.");

    const st = await mapa2dRepository.findSessionTerrenoById(sessionTerrenoId);
    if (!st || st.sessionId !== sessionId) throw new AppError(404, "Terreno não encontrado.");
    if (st.donoId !== playerId) throw new AppError(403, "Você não é dono deste terreno.");
    if (st.construcao) throw new AppError(400, "Este terreno já tem uma construção.");

    const custo = SLOTS_CONSTRUCAO[tipo] * CUSTO_POR_SLOT;
    const player = await mapa2dRepository.findPlayer(playerId);
    if (!player) throw new AppError(404, "Jogador não encontrado.");
    if (player.saldo < custo) throw new AppError(400, "Saldo insuficiente.");

    try {
      // Atômico: a constraint @unique em sessionTerrenoId impede duas construções
      // no mesmo terreno mesmo sob corrida (a segunda escrita simultânea falha aqui).
      await prisma.construcao.create({
        data: { sessionTerrenoId, tipo, nivel: 1, aluguelPedido: 0, ocupado: false },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(409, "Construção já iniciada neste terreno.");
      }
      throw err;
    }

    await mapa2dRepository.updatePlayerSaldo(playerId, -custo);

    await mapa2dRepository.criarHistorico(
      sessionId,
      "MAPA2D_CONSTRUCAO",
      `${player.nome} construiu ${tipo} em ${st.terreno.codigo} por R$ ${custo}`
    );

    emitToRoom(sessionId, "mapa2d:construcao_criada", { sessionTerrenoId, tipo, custo });

    return { sucesso: true, custo };
  }

  async precificar(sessionId: number, playerId: number, construcaoId: number, aluguelPedido: number) {
    if (!Number.isInteger(aluguelPedido) || aluguelPedido < 0) {
      throw new AppError(400, "Valor de aluguel inválido.");
    }

    const construcao = await mapa2dRepository.findConstrucaoDoJogador(construcaoId, playerId);
    if (!construcao || construcao.sessionTerreno.sessionId !== sessionId) {
      throw new AppError(404, "Construção não encontrada.");
    }

    await prisma.construcao.update({ where: { id: construcaoId }, data: { aluguelPedido } });

    emitToRoom(sessionId, "mapa2d:aluguel_precificado", { construcaoId, aluguelPedido });

    return { sucesso: true };
  }

  /** Aluguel recomendado — para exibir na UI antes do jogador decidir. */
  async getAluguelRecomendado(sessionTerrenoId: number, tipo: TipoConstrucao) {
    const st = await mapa2dRepository.findSessionTerrenoById(sessionTerrenoId);
    if (!st) throw new AppError(404, "Terreno não encontrado.");
    return economiaMapa2DService.calcularAluguelRecomendado(st.terreno.multiplicador, tipo);
  }
}

export const construcaoMapa2DService = new ConstrucaoMapa2DService();
