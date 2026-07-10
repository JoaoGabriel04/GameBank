import { Router } from "express";
import { turnoController } from "../../modules/turno/turno.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authenticateRoom } from "../../middleware/room-auth.middleware.js";

const turnoRouter = Router();

turnoRouter.post(
  "/:sessionId/passar-vez",
  authenticate,
  authenticateRoom("params", "sessionId"),
  turnoController.passarVez
);

turnoRouter.post(
  "/:sessionId/rolar-dados",
  authenticate,
  authenticateRoom("params", "sessionId"),
  turnoController.rolarDados
);

turnoRouter.post(
  "/:sessionId/comprar-casa-atual",
  authenticate,
  authenticateRoom("params", "sessionId"),
  turnoController.comprarCasaAtual
);

turnoRouter.post(
  "/:sessionId/recusar-compra",
  authenticate,
  authenticateRoom("params", "sessionId"),
  turnoController.recusarCompra
);

export default turnoRouter;
