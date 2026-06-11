import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

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
  console.error(err);
  return res.status(500).json({ message: "Erro interno." });
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  console.error("Erro interno:", err);
  return res.status(500).json({ message: "Erro interno do servidor" });
}
