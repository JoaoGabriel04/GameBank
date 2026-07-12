import { Router } from "express";
import { leilaoController } from "../../modules/leilao/leilao.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authenticateRoom } from "../../middleware/room-auth.middleware.js";

const leilaoRouter = Router();

leilaoRouter.post(
  "/:sessionId/lance",
  authenticate,
  authenticateRoom("params", "sessionId"),
  leilaoController.darLance
);

export default leilaoRouter;
