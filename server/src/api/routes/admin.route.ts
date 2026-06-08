import { Router } from "express";
import { adminController } from "../../modules/admin/admin.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { bannerUpload, badgeUpload, frameUpload } from "../../middleware/upload.middleware.js";
import { bannerAdminLimiter } from "../../modules/auth/auth.controller.js";
import { diamondAdminController } from "../../modules/diamonds/diamond-admin.controller.js";

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
adminRouter.get("/sessions/:id", adminController.getSessionDetail);
adminRouter.get("/sessions/:id/chat", adminController.getSessionChat);
adminRouter.post("/sessions/:id/end", adminController.endSession);
adminRouter.patch("/sessions/:id/players/:pid/balance", adminController.adjustPlayerBalance);

// Missions
adminRouter.get("/missions", adminController.listMissions);
adminRouter.post("/missions", adminController.createMission);
adminRouter.patch("/missions/:id", adminController.updateMission);
adminRouter.patch("/missions/:id/toggle", adminController.toggleMission);
adminRouter.delete("/missions/:id", adminController.deleteMission);

// Users
adminRouter.post("/users/notify", adminController.notifyUsers);
adminRouter.get("/users", adminController.listUsers);
adminRouter.patch("/users/:id/coins", adminController.adjustCoins);
adminRouter.patch("/users/:id/diamonds", adminController.adjustDiamonds);
adminRouter.patch("/users/:id/xp", adminController.adjustXp);
adminRouter.patch("/users/:id/level", adminController.setLevel);
adminRouter.post("/users/:id/ban", adminController.banUser);
adminRouter.post("/users/:id/unban", adminController.unbanUser);
adminRouter.patch("/users/:id/admin", adminController.setUserAdmin);
adminRouter.delete("/users/:id", adminController.deleteUser);

// Cards
adminRouter.get("/cards", adminController.listCards);
adminRouter.post("/cards", adminController.createCard);
adminRouter.patch("/cards/:id", adminController.updateCard);
adminRouter.delete("/cards/:id", adminController.deleteCard);

// GameSettings
adminRouter.get("/settings", adminController.getSettings);
adminRouter.patch("/settings", adminController.updateSettings);

// Banners
adminRouter.get("/banners", adminController.listBanners);
adminRouter.post("/banners", adminController.createBanner);
adminRouter.patch("/banners/:id", adminController.updateBanner);
adminRouter.delete("/banners/:id", adminController.deleteBanner);
adminRouter.post(
  "/banners/:id/image",
  bannerAdminLimiter,
  bannerUpload.single("image"),
  adminController.uploadBannerImage
);

// User banner sync (re-sync User.banner from equipped item JSON)
adminRouter.post("/users/:id/sync-banner", adminController.syncUserBanner);

// Frames
adminRouter.get("/frames", adminController.listFrames);
adminRouter.post("/frames", adminController.createFrame);
adminRouter.patch("/frames/:id", adminController.updateFrame);
adminRouter.delete("/frames/:id", adminController.deleteFrame);
adminRouter.post(
  "/frames/:id/image",
  frameUpload.single("image"),
  adminController.uploadFrameImage
);

// Badges
adminRouter.post(
  "/shop/badges/:id/image",
  bannerAdminLimiter,
  badgeUpload.single("image"),
  adminController.uploadBadgeImage
);

// Audit
adminRouter.get("/audit", adminController.listAudit);

// Diamond packages
adminRouter.get("/diamond-packages", diamondAdminController.listPackages);
adminRouter.post("/diamond-packages", diamondAdminController.createPackage);
adminRouter.patch("/diamond-packages/:id", diamondAdminController.updatePackage);
adminRouter.get("/diamond-purchases", diamondAdminController.listPurchases);

export default adminRouter;
