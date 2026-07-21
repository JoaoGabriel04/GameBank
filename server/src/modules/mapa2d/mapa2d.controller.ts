import { z } from "zod";
import type { Request, Response } from "express";
import { SessionService } from "../session/session.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { parseError } from "../../middleware/error-handler.middleware.js";
import { terrenoMapa2DService } from "./services/terreno.service.js";
import { construcaoMapa2DService } from "./services/construcao.service.js";
import { emprestimoMapa2DService } from "./services/emprestimo.service.js";
import { mapa2dService } from "./mapa2d.service.js";
import type { TipoConstrucao } from "../../../generated/prisma/index.js";

const sessionService = new SessionService();

const ConstruirSchema = z.object({
  tipo: z.enum(["casa", "sobrado", "comercio", "apartamento", "centro_comercial", "hotel", "corporativo"]),
});

const PrecificarSchema = z.object({
  aluguelPedido: z.number().int().nonnegative(),
});

const PegarEmprestimoSchema = z.object({
  valor: z.number().int().positive(),
});

async function getPlayerOuFalha(sessionId: number, userId: number) {
  const player = await sessionService.getPlayerByUser(sessionId, userId);
  if (!player) throw new AppError(404, "Você não está nesta sala.");
  return player;
}

export const mapa2dController = {
  comprarTerreno: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const terrenoId = z.coerce.number().int().positive().parse(req.params.terrenoId);
      const player = await getPlayerOuFalha(sessionId, req.user!.userId);
      const result = await terrenoMapa2DService.comprarTerreno(sessionId, player.id, terrenoId);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  construir: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const sessionTerrenoId = z.coerce.number().int().positive().parse(req.params.sessionTerrenoId);
      const player = await getPlayerOuFalha(sessionId, req.user!.userId);
      const { tipo } = ConstruirSchema.parse(req.body);
      const result = await construcaoMapa2DService.construir(sessionId, player.id, sessionTerrenoId, tipo as TipoConstrucao);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  precificar: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const construcaoId = z.coerce.number().int().positive().parse(req.params.construcaoId);
      const player = await getPlayerOuFalha(sessionId, req.user!.userId);
      const { aluguelPedido } = PrecificarSchema.parse(req.body);
      const result = await construcaoMapa2DService.precificar(sessionId, player.id, construcaoId, aluguelPedido);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  getEstado: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const player = await getPlayerOuFalha(sessionId, req.user!.userId);
      const result = await mapa2dService.getEstado(sessionId, player.id);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  subirNivel: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const construcaoId = z.coerce.number().int().positive().parse(req.params.construcaoId);
      const player = await getPlayerOuFalha(sessionId, req.user!.userId);
      const result = await construcaoMapa2DService.subirNivel(sessionId, player.id, construcaoId);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  pegarEmprestimo: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const player = await getPlayerOuFalha(sessionId, req.user!.userId);
      const { valor } = PegarEmprestimoSchema.parse(req.body);
      const result = await emprestimoMapa2DService.pegarEmprestimo(sessionId, player.id, valor);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },

  quitarEmprestimo: async (req: Request, res: Response) => {
    try {
      const sessionId = z.coerce.number().int().positive().parse(req.params.sessionId);
      const player = await getPlayerOuFalha(sessionId, req.user!.userId);
      const result = await emprestimoMapa2DService.quitarEmprestimo(sessionId, player.id);
      return res.status(200).json(result);
    } catch (err) {
      return parseError(res, err);
    }
  },
};
