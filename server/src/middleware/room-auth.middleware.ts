import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { verifyRoomToken, signRoomToken, getRoomTokenRefreshThreshold, type RoomJwtPayload } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";

declare global {
  namespace Express {
    interface Request {
      roomAccess?: RoomJwtPayload;
    }
  }
}

export function authenticateRoom(sessionIdParam: "params" | "body" | "query" = "params", sessionKey: string = "sessionId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req[sessionIdParam]?.[sessionKey] ?? req[sessionIdParam]?.sessionId ?? req.params.sessionId;
      if (!sessionId) {
        return res.status(400).json({ message: "ID da sessão não fornecido" });
      }

      const session = await prisma.session.findUnique({
        where: { id: Number(sessionId) },
        select: { id: true, senha: true },
      });

      if (!session) {
        return res.status(404).json({ message: "Sessão não encontrada" });
      }

      // Sala pública — sem senha, não precisa de token
      if (!session.senha) {
        req.roomAccess = { sessionId: session.id };
        return next();
      }

      // Sala com senha — exige token, a menos que usuário JWT já seja jogador
      const authedUserId = req.user?.userId;

      if (authedUserId) {
        const isPlayer = await prisma.sessionPlayer.findFirst({
          where: { userId: authedUserId, sessionId: Number(sessionId) },
          select: { id: true },
        });
        if (isPlayer) {
          req.roomAccess = { sessionId: Number(sessionId) };
          return next();
        }
      }

      const cookieName = `room_token_${sessionId}`;
      const token = req.cookies?.[cookieName] || req.headers["x-room-token"] as string | undefined;

      if (!token) {
        return res.status(401).json({ message: "Acesso não autorizado a esta sala" });
      }

      try {
        const payload = verifyRoomToken(token);

        if (payload.sessionId !== Number(sessionId)) {
          return res.status(403).json({ message: "Token não pertence a esta sala" });
        }

        req.roomAccess = payload;

        const decoded = jwt.decode(token) as { exp: number } | null;
        if (decoded?.exp) {
          const expiresInMs = (decoded.exp * 1000) - Date.now();
          if (expiresInMs > 0 && expiresInMs < getRoomTokenRefreshThreshold()) {
            const newToken = signRoomToken({ sessionId: payload.sessionId, playerId: payload.playerId });
            res.cookie(cookieName, newToken, {
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              maxAge: 24 * 60 * 60 * 1000,
              path: "/",
            });
          }
        }

        next();
      } catch {
        return res.status(401).json({ message: "Token de sala inválido ou expirado" });
      }
    } catch (err) {
      logger.error({ err }, "authenticateRoom erro inesperado");
      res.status(500).json({ message: "Erro interno ao verificar acesso à sala" });
    }
  };
}

export function setRoomCookie(res: Response, sessionId: number, playerId?: number): string {
  const token = signRoomToken({ sessionId, playerId });
  res.cookie(`room_token_${sessionId}`, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });
  return token;
}