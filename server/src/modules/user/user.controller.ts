import type { Request, Response } from "express";
import { UserService } from "./user.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitUpdatedSession } from "../socket/socket.handler.js";

const userService = new UserService();

export const userController = {
  getById: async (req: Request, res: Response) => {
    const { playerId } = req.params;

    try {
      const player = await userService.getPlayerById(parseInt(playerId));
      res.status(200).json(player);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao buscar jogador:", err);
      res.status(500).json({ message: "Erro ao buscar jogador" });
    }
  },

  editPlayer: async (req: Request, res: Response) => {
    const { playerId } = req.params;
    const { nome, cor } = req.body;

    try {
      const player = await userService.editPlayer(parseInt(playerId), nome, cor);
      const sessionId = (player as any).sessionId;
      if (sessionId) await emitUpdatedSession(sessionId);
      res.status(200).json(player);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao editar jogador:", err);
      res.status(500).json({ message: "Erro ao editar jogador" });
    }
  },

  removePlayer: async (req: Request, res: Response) => {
    const { playerId } = req.params;
    const requesterUserId = req.user!.userId;

    try {
      const result = await userService.removePlayer(parseInt(playerId), requesterUserId);
      if (result.sessionId) await emitUpdatedSession(result.sessionId);
      res.status(200).json({ message: "Jogador removido com sucesso", player: result });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao remover jogador:", err);
      res.status(500).json({ message: "Erro ao remover jogador" });
    }
  },
};

export default userController;
