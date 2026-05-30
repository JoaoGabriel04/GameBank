import type { Request, Response } from "express";
import { SessionService } from "./session.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { setRoomCookie } from "../../middleware/room-auth.middleware.js";
import { emitSessionUpdated, emitSessionClosed } from "../socket/socket.handler.js";

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
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: "Erro ao criar a sessão." });
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
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: "Erro ao entrar na sessão." });
    }
  },

  start_session: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      const result = await sessionService.startSession(Number(sessionId), userId);
      emitSessionUpdated(result!.id, result);
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: "Erro ao iniciar a sessão." });
    }
  },

  get_sessions: async (_req: Request, res: Response) => {
    try {
      const sessions = await sessionService.listSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Erro ao buscar sessões:", error);
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
      console.error("Erro ao buscar sessão:", err);
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
      console.error("Erro ao buscar sessão ativa:", err);
      res.status(500).json({ session: null });
    }
  },

  backfill_user: async (req: Request, res: Response) => {
    try {
      const { playerId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      await sessionService.backfillPlayerUserId(Number(playerId), userId);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Erro ao backfill userId:", err);
      res.status(500).json({ error: "Erro ao associar usuário ao jogador" });
    }
  },

  quit_session: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      await sessionService.quitSession(Number(sessionId), userId);
      res.clearCookie(`room_token_${sessionId}`, { path: "/" });
      emitSessionUpdated(Number(sessionId), await sessionService.loadSession(Number(sessionId)));
      return res.status(200).json({ message: "Você saiu da sala." });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: "Erro ao sair da sala." });
    }
  },

  my_player: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const player = await sessionService.getPlayerByUser(Number(sessionId), userId);
      return res.status(200).json({ player });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao buscar seu jogador." });
    }
  },

  desistir_session: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      await sessionService.desistirSession(Number(sessionId), userId);
      emitSessionUpdated(Number(sessionId), await sessionService.loadSession(Number(sessionId)));
      return res.status(200).json({ message: "Você desistiu da partida." });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: "Erro ao desistir da partida." });
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
      await sessionService.endSession(sessionIdNum, userId);
      emitSessionClosed(sessionIdNum);
      res.status(200).json({ message: "Sessão encerrada e removida com sucesso" });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Erro ao encerrar sessão:", error);
      res.status(500).json({ message: "Erro ao encerrar sessão" });
    }
  },
};

export default sessionController;
