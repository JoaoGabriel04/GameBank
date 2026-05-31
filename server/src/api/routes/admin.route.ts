import { Router } from "express";
import { adminController } from "../../modules/admin/admin.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";

const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

// Dashboard
adminRouter.get("/dashboard", adminController.getDashboard);

// ShopItems
adminRouter.get("/shop/items", adminController.listItems);
adminRouter.post("/shop/items", adminController.createItem);
adminRouter.patch("/shop/items/:id", adminController.updateItem);
adminRouter.patch("/shop/items/:id/toggle", adminController.toggleItem);
adminRouter.delete("/shop/items/:id", adminController.deleteItem);

// Sessions
adminRouter.get("/sessions", adminController.listSessions);

// Missions
adminRouter.get("/missions", adminController.listMissions);
adminRouter.post("/missions", adminController.createMission);
adminRouter.patch("/missions/:id", adminController.updateMission);
adminRouter.delete("/missions/:id", adminController.deleteMission);

// Users
adminRouter.get("/users", adminController.listUsers);
adminRouter.patch("/users/:id/coins", adminController.adjustCoins);

export default adminRouter;
