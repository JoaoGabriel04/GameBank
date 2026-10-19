import type { Request, Response } from "express";
import { z } from "zod";
import { HistoricoService } from "./historico.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { logger } from "../../lib/logger.js";

const historicoService = new HistoricoService();

const PaginaHistoricoSchema = z.object({
  limite: z.coerce.number().int().min(1).max(200).default(100),
  antesDe: z.coerce.number().int().positive().optional(),
});

export const historicoController = {
  test: (_req: Request, res: Response) => {
    res.send("Hello World! Esse é o histórico.");
  },

  listar: async (req: Request, res: Response) => {
    try {
      const sessionId = Number(req.params.sessionId);
      const { limite, antesDe } = PaginaHistoricoSchema.parse(req.query);
      const pagina = await historicoService.listarPagina(sessionId, limite, antesDe);
      res.status(200).json(pagina);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Parâmetros de paginação inválidos" });
      }
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error({ err }, "Erro ao buscar históricos!");
      res.status(500).json({ message: "Erro ao buscar históricos" });
    }
  },
};
