import { Router } from "express";
import missionsController from "../../modules/missions/missions.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const missionsRouter = Router();

missionsRouter.get("/", authenticate, missionsController.list);

export default missionsRouter;
