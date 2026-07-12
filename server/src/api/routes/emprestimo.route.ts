import { Router } from "express";
import { emprestimoController } from "../../modules/emprestimo/emprestimo.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authenticateRoom } from "../../middleware/room-auth.middleware.js";

const emprestimoRouter = Router();

emprestimoRouter.get(
  "/:sessionId/limite",
  authenticate,
  authenticateRoom("params", "sessionId"),
  emprestimoController.getLimite
);

emprestimoRouter.post(
  "/:sessionId/pegar",
  authenticate,
  authenticateRoom("params", "sessionId"),
  emprestimoController.pegar
);

emprestimoRouter.post(
  "/:sessionId/quitar",
  authenticate,
  authenticateRoom("params", "sessionId"),
  emprestimoController.quitar
);

export default emprestimoRouter;
