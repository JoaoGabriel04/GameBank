import { Router } from "express";
import missionsController from "../../modules/missions/missions.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const missionsRouter = Router();

missionsRouter.get("/", authenticate, missionsController.list);
missionsRouter.post("/claim-all", authenticate, missionsController.claimAll);
missionsRouter.post("/:id/claim", authenticate, missionsController.claim);

export default missionsRouter;
