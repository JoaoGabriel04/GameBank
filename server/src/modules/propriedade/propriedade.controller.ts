import type { Request, Response } from "express";
import { PropriedadeService } from "./propriedade.service.js";
import { SessionService } from "../session/session.service.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitSessionUpdated, emitNotificationNew } from "../socket/socket.handler.js";

const propriedadeService = new PropriedadeService();
const sessionService = new SessionService();

async function emitUpdatedSession(sessionId: number) {
  await sessionService.invalidateCache(sessionId);
  const session = await sessionService.loadSession(sessionId);
  emitSessionUpdated(sessionId, session);
}

export const propsController = {
  getPropById: async (req: Request, res: Response) => {
    const { propriedadeId } = req.params;
    try {
      const propriedade = await propriedadeService.getPropById(parseInt(propriedadeId));
      res.status(200).json(propriedade);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao buscar propriedade: ", err);
      res.status(500).json({ message: "Erro ao buscar propriedade" });
    }
  },

  buyProp: async (req: Request, res: Response) => {
    const { propriedadeId, sessionId, userId } = req.body;

    try {
      const result = await propriedadeService.buyProp(
        parseInt(propriedadeId),
        parseInt(sessionId),
        parseInt(userId)
      );
      await emitUpdatedSession(parseInt(sessionId));
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao comprar propriedade: ", err);
      res.status(500).json({ message: "Erro ao comprar propriedade" });
    }
  },

  buyHouse: async (req: Request, res: Response) => {
    const { sessionId, userId, propriedadeId } = req.body;
    if (!sessionId || !userId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      await propriedadeService.buyHouse(Number(userId), Number(sessionId), parseInt(propriedadeId));
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Casa comprada com sucesso!" });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao comprar casa:", err);
      res.status(500).json({ message: "Erro interno ao comprar casa." });
    }
  },

  buyHousesBatch: async (req: Request, res: Response) => {
    const { sessionId, userId, sessaoPossesIds } = req.body;
    if (!sessionId || !userId || !sessaoPossesIds) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      await propriedadeService.buyHousesBatch(Number(userId), Number(sessionId), sessaoPossesIds);
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Casas compradas com sucesso!" });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao comprar casas em lote:", err);
      res.status(500).json({ message: "Erro interno ao comprar casas em lote." });
    }
  },

  sellHousesBatch: async (req: Request, res: Response) => {
    const { sessionId, userId, items } = req.body;
    if (!sessionId || !userId || !items) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      await propriedadeService.sellHousesBatch(Number(userId), Number(sessionId), items);
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Casas vendidas com sucesso!" });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao vender casas em lote:", err);
      res.status(500).json({ message: "Erro interno ao vender casas em lote." });
    }
  },

  sellHouse: async (req: Request, res: Response) => {
    const { propriedadeId, sessionId, userId } = req.body;
    if (!sessionId || !userId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      await propriedadeService.sellHouse(Number(userId), Number(sessionId), parseInt(propriedadeId));
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Casa vendida com sucesso!" });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao vender casa:", err);
      res.status(500).json({ message: "Erro interno ao vender casa." });
    }
  },

  sellPropriedade: async (req: Request, res: Response) => {
    const { propriedadeId, sessionId, userId } = req.body;
    if (!sessionId || !userId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const propriedadeAtualizada = await propriedadeService.sellPropriedade(
        parseInt(propriedadeId),
        Number(sessionId),
        Number(userId)
      );
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Propriedade vendida com sucesso!", propriedade: propriedadeAtualizada });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao vender propriedade!", err);
      return res.status(500).json({ message: "Erro interno ao vender propriedade." });
    }
  },

  hipotecarPropriedade: async (req: Request, res: Response) => {
    const { propriedadeId, sessionId, userId } = req.body;
    if (!sessionId || !userId) {
      return res.status(400).json({ message: "Campos vazios ou errados!" });
    }

    try {
      const result = await propriedadeService.hipotecarPropriedade(
        parseInt(propriedadeId),
        Number(sessionId),
        Number(userId)
      );
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Propriedade hipotecada com sucesso!", propriedade: result });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao hipotecar propriedade!", err);
      return res.status(500).json({ message: "Erro interno ao hipotecar propriedade." });
    }
  },

  comprarHipotecada: async (req: Request, res: Response) => {
    const { sessionPossesId, sessionId, compradorId } = req.body;
    if (!sessionPossesId || !sessionId || !compradorId) {
      return res.status(400).json({ message: "Campos obrigatórios ausentes" });
    }

    try {
      const result = await propriedadeService.comprarHipotecada(
        parseInt(sessionPossesId),
        parseInt(sessionId),
        parseInt(compradorId)
      );
      await emitUpdatedSession(parseInt(sessionId));
      const r = result as any;
      if (r?.notification) {
        emitNotificationNew(parseInt(sessionId), r.notification);
      }
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao comprar hipoteca:", err);
      return res.status(500).json({ message: "Erro interno ao comprar hipoteca" });
    }
  },

  responderNotificacao: async (req: Request, res: Response) => {
    const { id } = req.params;
    const { aceitar, respondedorId, sessionId } = req.body;
    if (aceitar === undefined || !respondedorId || !sessionId) {
      return res.status(400).json({ message: "Campos obrigatórios ausentes" });
    }

    try {
      const result = await propriedadeService.responderNotificacao(
        parseInt(id),
        aceitar,
        parseInt(respondedorId)
      );
      await emitUpdatedSession(parseInt(sessionId));
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao responder notificação:", err);
      return res.status(500).json({ message: "Erro interno ao responder notificação" });
    }
  },

  trocarPropriedade: async (req: Request, res: Response) => {
    const { propriedadeId, sessionId, userId } = req.body;
    if (!propriedadeId || !sessionId || !userId) {
      return res.status(400).json({ message: "Campos vazios" });
    }

    try {
      await propriedadeService.trocarPropriedade(
        parseInt(propriedadeId),
        Number(sessionId),
        Number(userId)
      );
      await emitUpdatedSession(Number(sessionId));
      return res.status(200).json({ message: "Propriedade trocada com sucesso!" });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Erro ao trocar propriedade!", err);
      return res.status(500).json({ message: "Erro interno ao trocar propriedade." });
    }
  },
};

export default propsController;
