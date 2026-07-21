import { Router } from "express";
import { mapa2dController } from "../../modules/mapa2d/mapa2d.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authenticateRoom } from "../../middleware/room-auth.middleware.js";

const mapa2dRouter = Router();

mapa2dRouter.get(
  "/:sessionId/estado",
  authenticate,
  authenticateRoom("params", "sessionId"),
  mapa2dController.getEstado
);

mapa2dRouter.post(
  "/:sessionId/terreno/:terrenoId/comprar",
  authenticate,
  authenticateRoom("params", "sessionId"),
  mapa2dController.comprarTerreno
);

mapa2dRouter.post(
  "/:sessionId/terreno/:sessionTerrenoId/construir",
  authenticate,
  authenticateRoom("params", "sessionId"),
  mapa2dController.construir
);

mapa2dRouter.post(
  "/:sessionId/construcao/:construcaoId/precificar",
  authenticate,
  authenticateRoom("params", "sessionId"),
  mapa2dController.precificar
);

export default mapa2dRouter;
