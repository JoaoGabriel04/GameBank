import { Router } from "express";
import profileController from "../../modules/profile/profile.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { avatarProfileLimiter } from "../../modules/auth/auth.controller.js";
import { avatarUpload } from "../../middleware/upload.middleware.js";

const profileRouter = Router();

profileRouter.get("/me", authenticate, profileController.me);
profileRouter.get("/history", authenticate, profileController.history);
profileRouter.get("/notifications", authenticate, profileController.getNotifications);
profileRouter.patch("/notifications/read", authenticate, profileController.markNotificationsRead);
profileRouter.patch(
  "/me",
  authenticate,
  avatarProfileLimiter,
  avatarUpload.single("avatar"),
  profileController.updateMe
);

export default profileRouter;
