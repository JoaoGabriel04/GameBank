import { Router } from "express";
import rankingController from "../../modules/ranking/ranking.controller.js";

const rankingRouter = Router();

rankingRouter.get("/", rankingController.global);

export default rankingRouter;
