import type { Request, Response } from "express";
import { BancoService } from "./banco.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitUpdatedSession } from "../socket/socket.handler.js";
import { emitToRoom, emitToUserWithRetry } from "../../lib/socket.js";
import { logger } from "../../lib/logger.js";

const bancoService = new BancoService();

export const bancoController = {
  test: (_req: Request, res: Response) => {
    res.send("Hello World! Você está na área de banco!");
  },

  deposito: async (req: Request, res: Response) => {
    const { userId, sessionId, valor } = req.body;
    if (!userId || !sessionId || !valor) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      await bancoService.deposito(Number(userId), Number(sessionId), Number(valor));
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Depósito realizado com sucesso!" });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro no depósito!");
      return res.status(500).json({ message: "Erro interno no depósito." });
    }
  },

  saque: async (req: Request, res: Response) => {
    const { userId, sessionId, valor } = req.body;
    if (!userId || !sessionId || !valor) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      await bancoService.saque(Number(userId), Number(sessionId), Number(valor));
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Saque realizado com sucesso!" });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro no saque!");
      return res.status(500).json({ message: "Erro interno no saque." });
    }
  },

  transferencia: async (req: Request, res: Response) => {
    const { pagadorId, recebedorId, sessionId, valor } = req.body;
    if (!pagadorId || !recebedorId || !sessionId || !valor) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const result = await bancoService.transferencia(Number(pagadorId), Number(recebedorId), Number(sessionId), Number(valor));
      // Broadcast na sala é mais confiável que emitToUserWithRetry individual
      emitToRoom(Number(sessionId), "transferencia:toast", {
        fromPlayerNome: result.pagadorNome,
        toPlayerId: result.recebedorId,
        toUserId: result.recebedorUserId,
        valor: result.valor,
      });
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Transferência realizada com sucesso!" });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro na transferência!");
      return res.status(500).json({ message: "Erro interno na transferência." });
    }
  },

  pagarAluguel: async (req: Request, res: Response) => {
    const { sessionId, pagadorId, sessionPossesId } = req.body;
    if (!sessionId || !pagadorId || !sessionPossesId) {
      return res.status(400).json({ message: "Campos faltando" });
    }

    try {
      const result = await bancoService.pagarAluguel(Number(sessionId), Number(pagadorId), Number(sessionPossesId));
      emitToRoom(Number(sessionId), "aluguel:toast", {
        fromPlayerNome: result.pagadorNome,
        toPlayerId: result.recebedorId,
        toUserId: result.recebedorUserId,
        valor: result.valor,
        propriedadeNome: result.propriedadeNome,
      });
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Aluguel pago", valor: result.valor });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro ao pagar aluguel");
      return res.status(500).json({ message: "Erro interno" });
    }
  },

  aluguelAcao: async (req: Request, res: Response) => {
    const { sessionId, pagadorId, sessionPossesId, numDados } = req.body;
    if (!sessionId || !pagadorId || !sessionPossesId || !numDados) {
      return res.status(400).json({ message: "Campos faltando" });
    }

    try {
      const result = await bancoService.aluguelAcao(Number(sessionId), Number(pagadorId), Number(sessionPossesId), Number(numDados));
      emitToRoom(Number(sessionId), "aluguel:toast", {
        fromPlayerNome: result.pagadorNome,
        toPlayerId: result.recebedorId,
        toUserId: result.recebedorUserId,
        valor: result.valor,
        propriedadeNome: result.propriedadeNome,
      });
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({
        message: `${result.pagadorNome} pagou R$ ${result.valor} para ${result.recebedorNome}`,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro ao pagar aluguel de ação");
      return res.status(500).json({ message: "Erro interno" });
    }
  },

  receberDeTodos: async (req: Request, res: Response) => {
    const { sessionId, userId } = req.body;
    if (!sessionId || !userId) {
      return res.status(400).json({ message: "Campos faltando" });
    }

    try {
      const result = await bancoService.receberDeTodos(Number(sessionId), Number(userId));
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({
        message: `O jogador ${result.jogador} recebeu R$ 500 de todos os jogadores, um total de ${result.total}!`,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro na transferência!");
      return res.status(500).json({ message: "Erro interno" });
    }
  },
};

