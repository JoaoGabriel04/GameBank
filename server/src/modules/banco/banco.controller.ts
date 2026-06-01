import type { Request, Response } from "express";
import { BancoService } from "./banco.service.js";
import { SessionService } from "../session/session.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitSessionUpdated } from "../socket/socket.handler.js";
import { emitToUserWithRetry } from "../../lib/socket.js";

const bancoService = new BancoService();
const sessionService = new SessionService();

async function emitUpdatedSession(sessionId: number) {
  await sessionService.invalidateCache(sessionId);
  const session = await sessionService.loadSession(sessionId);
  emitSessionUpdated(sessionId, session);
}

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
      console.error("Erro no depósito!", err);
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
      console.error("Erro no saque!", err);
      return res.status(500).json({ message: "Erro interno no saque." });
    }
  },

  transferencia: async (req: Request, res: Response) => {
    const { pagadorId, recebedorId, sessionId, valor } = req.body;
    if (!pagadorId || !recebedorId || !sessionId || !valor) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      await bancoService.transferencia(Number(pagadorId), Number(recebedorId), Number(sessionId), Number(valor));
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Transferência realizada com sucesso!" });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro na transferência!", err);
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
      if (result.recebedorUserId) {
        const delivered = await emitToUserWithRetry(result.recebedorUserId, "aluguel:received", {
          fromPlayerNome: result.pagadorNome,
          toPlayerId: result.recebedorId,
          valor: result.valor,
          propriedadeNome: result.propriedadeNome,
        });
        if (!delivered) console.error(`[Banco] Falha ao notificar aluguel para usuário ${result.recebedorUserId}`);
      }
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Aluguel pago", valor: result.valor });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao pagar aluguel:", err);
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
      if (result.recebedorUserId) {
        const delivered = await emitToUserWithRetry(result.recebedorUserId, "aluguel:received", {
          fromPlayerNome: result.pagadorNome,
          toPlayerId: result.recebedorId,
          valor: result.valor,
          propriedadeNome: result.propriedadeNome,
        });
        if (!delivered) console.error(`[Banco] Falha ao notificar aluguel para usuário ${result.recebedorUserId}`);
      }
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({
        message: `${result.pagadorNome} pagou R$ ${result.valor} para ${result.recebedorNome}`,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao pagar aluguel de ação:", err);
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
      console.error("Erro na transferência!", err);
      return res.status(500).json({ message: "Erro interno" });
    }
  },
};

export default bancoController;
