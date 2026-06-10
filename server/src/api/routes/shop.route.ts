import { Router } from "express";
import shopController from "../../modules/shop/shop.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const shopRouter = Router();

shopRouter.get("/items", shopController.listItems);
shopRouter.get("/catalogo", authenticate, shopController.catalogo);
shopRouter.post("/buy/:itemId", authenticate, shopController.buyItem);
shopRouter.post("/sell/:itemId", authenticate, shopController.sellItem);
shopRouter.post("/equip/:itemId", authenticate, shopController.equipItem);
shopRouter.post("/sync-banner", authenticate, shopController.syncBanner);
shopRouter.post("/coins-buy", authenticate, shopController.buyCoinsWithDiamonds);
shopRouter.post("/diamonds-buy", authenticate, shopController.buyDiamonds);
shopRouter.post("/buy-diamonds/:itemId", authenticate, shopController.buyItemWithDiamonds);

export default shopRouter;
