import type { Request, Response } from "express";
import { SessionService } from "./session.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { setRoomCookie } from "../../middleware/room-auth.middleware.js";
import { emitSessionUpdated, emitSessionClosed } from "../socket/socket.handler.js";
import { sessionLogger } from "../../lib/logger.js";

const sessionService = new SessionService();

export const sessionController = {
  test: (_req: Request, res: Response) => {
    res.send("Hello World!");
  },

  new_session: async (req: Request, res: Response) => {
    try {
      const { nome, senha, modo, maxJogadores, saldoInicial, times, criadorNome, criadorCor, criadorTeamIndex } = req.body;
      const userId = req.user?.userId;
      const result = await sessionService.createSession(nome, senha, modo, maxJogadores, saldoInicial, userId, times, criadorNome, criadorCor, criadorTeamIndex);
      if (result?.session?.id) {
        const token = setRoomCookie(res, result.session.id, result.playerId);
        const session = await sessionService.loadSession(result.session.id);
        emitSessionUpdated(result.session.id, session);
        return res.status(201).json({ ...session, roomToken: token });
      }
      return res.status(201).json(result);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      sessionLogger.error({ err });
      return res.status(500).json({ message: "Erro ao criar a sessão." });
    }
  },

  join_session: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { senha, nome, cor, teamId, spectator } = req.body;
      const userId = req.user?.userId;
      const result = await sessionService.joinSession(
        Number(sessionId), senha, nome, cor, userId, teamId, spectator
      );
      const token = setRoomCookie(res, result.sessionId, result.playerId);
      const session = await sessionService.loadSession(result.sessionId);
      emitSessionUpdated(result.sessionId, session);
      return res.status(200).json({ ...session, roomToken: token });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      sessionLogger.error({ err });
      return res.status(500).json({ message: "Erro ao entrar na sessão." });
    }
  },

  start_session: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      await sessionService.startSession(Number(sessionId), userId);
      const session = await sessionService.loadSession(Number(sessionId));
      emitSessionUpdated(Number(sessionId), session);
      return res.status(200).json(session);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      sessionLogger.error({ err });
      return res.status(500).json({ message: "Erro ao iniciar a sessão." });
    }
  },

  get_sessions: async (_req: Request, res: Response) => {
    try {
      const sessions = await sessionService.listSessions();
      res.json(sessions);
    } catch (error) {
      sessionLogger.error({ err: error }, "Erro ao buscar sessões");
      res.status(500).json({ message: "Erro ao buscar sessões" });
    }
  },

  load_session: async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    try {
      const sessionIdNum = parseInt(sessionId);

      // Auto-backfill: se roomAccess tem playerId mas player não tem userId, associa
      if (req.user?.userId && req.roomAccess?.playerId) {
        await sessionService.backfillPlayerUserId(req.roomAccess.playerId, req.user.userId);
        // Notifica outros jogadores que este player foi associado
        emitSessionUpdated(sessionIdNum, await sessionService.loadSession(sessionIdNum));
      }

      const session = await sessionService.loadSession(sessionIdNum);
      res.status(200).json(session);
    } catch (err) {
      // Se a sessão não existe, limpa cookie de sala inválido
      if (err instanceof AppError && err.statusCode === 404) {
        res.clearCookie(`room_token_${sessionId}`, { path: "/" });
        return res.status(404).json({ message: err.message });
      }
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      sessionLogger.error({ err }, "Erro ao buscar sessão");
      res.status(500).json({ message: "Erro ao buscar sessão" });
    }
  },

  my_active: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(200).json({ session: null });
      }
      const session = await sessionService.findMyActiveSession(userId);
      res.status(200).json({ session });
    } catch (err) {
      sessionLogger.error({ err }, "Erro ao buscar sessão ativa");
      res.status(500).json({ session: null });
    }
  },

  backfill_user: async (req: Request, res: Response) => {
    try {
      const { playerId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      const { SessionService } = await import("./session.service.js");
      const svc = new SessionService();
      await svc.backfillPlayerUserId(Number(playerId), userId);
      // Busca o sessionId a partir do playerId para emitir atualização
      try {
        const { prisma } = await import("../../lib/prisma.js");
        const player = await prisma.sessionPlayer.findUnique({
          where: { id: Number(playerId) },
          select: { sessionId: true },
        });
        if (player?.sessionId) {
          const session = await svc.loadSession(player.sessionId);
          emitSessionUpdated(player.sessionId, session);
        }
      } catch {}
      res.status(200).json({ ok: true });
    } catch (err) {
      sessionLogger.error({ err }, "Erro ao backfill userId");
      res.status(500).json({ message: "Erro ao associar usuário ao jogador" });
    }
  },

  quit_session: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const sessionIdNum = Number(sessionId);
      const result = await sessionService.quitSession(sessionIdNum, userId);
      res.clearCookie(`room_token_${sessionId}`, { path: "/" });

      if (result?.autoEnded) {
        emitSessionClosed(sessionIdNum, result.ranking);
      } else {
        emitSessionUpdated(sessionIdNum, await sessionService.loadSession(sessionIdNum));
      }
      return res.status(200).json({ message: "Você saiu da sala." });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      sessionLogger.error({ err });
      return res.status(500).json({ message: "Erro ao sair da sala." });
    }
  },

  my_player: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const player = await sessionService.getPlayerByUser(Number(sessionId), userId);
      res.status(200).json({ player });
    } catch (err) {
      sessionLogger.error({ err });
      res.status(500).json({ message: "Erro ao buscar seu jogador." });
    }
  },

  desistir_session: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const sessionIdNum = Number(sessionId);
      const result = await sessionService.desistirSession(sessionIdNum, userId);

      if (result?.autoEnded) {
        emitSessionClosed(sessionIdNum, result.ranking);
      } else {
        emitSessionUpdated(sessionIdNum, await sessionService.loadSession(sessionIdNum));
      }
      return res.status(200).json({ message: "Você desistiu da partida." });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      sessionLogger.error({ err });
      return res.status(500).json({ message: "Erro ao desistir da partida." });
    }
  },

  end_session: async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const sessionIdNum = Number(sessionId);
    if (isNaN(sessionIdNum)) {
      return res.status(400).json({ message: "ID de sessão inválido" });
    }

    try {
      const userId = req.user?.userId;
      const isAdmin = req.user?.isAdmin ?? false;
      const ranked = await sessionService.endSession(sessionIdNum, userId, isAdmin);
      emitSessionClosed(sessionIdNum, ranked);
      res.status(200).json({ message: "Sessão encerrada e removida com sucesso", ranking: ranked });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      sessionLogger.error({ err: error }, "Erro ao encerrar sessão");
      res.status(500).json({ message: "Erro ao encerrar sessão" });
    }
  },

  get_resultado: async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const sessionIdNum = Number(sessionId);
    if (isNaN(sessionIdNum)) {
      return res.status(400).json({ message: "ID de sessão inválido" });
    }
    try {
      const ranking = await sessionService.getGameResults(sessionIdNum);
      if (!ranking) return res.status(404).json({ message: "Resultado não encontrado" });
      res.status(200).json({ ranking });
    } catch (error) {
      sessionLogger.error({ err: error }, "Erro ao buscar resultado da sessão");
      res.status(500).json({ message: "Erro ao buscar resultado" });
    }
  },
};

