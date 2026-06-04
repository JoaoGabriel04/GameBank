import { Router } from "express";
import shopController from "../../modules/shop/shop.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const shopRouter = Router();

shopRouter.get("/items", shopController.listItems);
shopRouter.post("/buy/:itemId", authenticate, shopController.buyItem);
shopRouter.post("/sell/:itemId", authenticate, shopController.sellItem);
shopRouter.post("/equip/:itemId", authenticate, shopController.equipItem);
shopRouter.post("/sync-banner", authenticate, shopController.syncBanner);

export default shopRouter;
