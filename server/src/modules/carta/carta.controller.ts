import type { Request, Response } from "express";
import { CartaService } from "./carta.service.js";
import { CartaRepository, carregarBaralho } from "./carta.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitUpdatedSession } from "../socket/socket.handler.js";
import { getIO } from "../../lib/socket.js";
import { logger } from "../../lib/logger.js";

const cartaService = new CartaService();
const cartaRepo = new CartaRepository();

async function getPlayerNome(playerId: number): Promise<string> {
  const p = await cartaRepo.findPlayerById(playerId);
  return p?.nome ?? "Desconhecido";
}

export const cartaController = {
  sortearCarta: async (req: Request, res: Response) => {
    const { sessionId, playerId } = req.body;
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const result = await cartaService.sortearCarta(
        Number(sessionId),
        Number(playerId)
      );

      const playerNome = await getPlayerNome(Number(playerId));
      getIO()
        .of("/game")
        .to(`session:${sessionId}`)
        .emit("card:drawn", {
          playerNome,
          playerId: Number(playerId),
          tipoBaralho: result.tipoBaralho,
          carta: result.carta,
          effectDescription: result.effectDescription,
          ...(result.debtCreated ? { debtCreated: true, debtValor: result.debtValor } : {}),
        });

      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro ao sortear carta!");
      return res.status(500).json({ message: "Erro interno ao sortear carta." });
    }
  },

  usarCartaPrisao: async (req: Request, res: Response) => {
    const { sessionId, playerId } = req.body;
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const effectDescription = await cartaService.usarCartaPrisao(
        Number(sessionId),
        Number(playerId)
      );

      const playerNome = await getPlayerNome(Number(playerId));
      getIO()
        .of("/game")
        .to(`session:${sessionId}`)
        .emit("carta_prisao:usada", {
          playerNome,
          playerId: Number(playerId),
        });

      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: effectDescription });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro ao usar carta prisão!");
      return res.status(500).json({ message: "Erro interno ao usar carta prisão." });
    }
  },

  listarCartas: async (req: Request, res: Response) => {
    try {
      const baralho = carregarBaralho();
      return res.status(200).json(baralho);
    } catch (err) {
      logger.error({ err }, "Erro ao listar cartas!");
      return res.status(500).json({ message: "Erro ao listar cartas." });
    }
  },
};

