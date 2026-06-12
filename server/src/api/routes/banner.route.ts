import { Router } from "express";
import { bannerController } from "../../modules/banner/banner.controller.js";

const bannerRouter = Router();

bannerRouter.get("/", bannerController.listPublic);

export default bannerRouter;
