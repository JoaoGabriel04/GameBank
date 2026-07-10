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

export default turnoRouter;
