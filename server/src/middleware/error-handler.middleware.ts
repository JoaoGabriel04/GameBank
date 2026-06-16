import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Sentry } from "../lib/sentry.js";
import { logger } from "../lib/logger.js";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function parseError(res: Response, err: unknown) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Dados inválidos", details: err.flatten().fieldErrors });
  }
  logger.error({ err }, "erro interno");
  return res.status(500).json({ message: "Erro interno." });
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  if (process.env.NODE_ENV !== "development") {
    const user = (req as any).user;
    Sentry.captureException(err, {
      user: user ? { id: String(user.userId) } : undefined,
      extra: {
        url: req.url,
        method: req.method,
      },
    });
  }

  logger.error({ err, url: req.url, method: req.method }, "erro interno do servidor");
  return res.status(500).json({ message: "Erro interno do servidor" });
}
