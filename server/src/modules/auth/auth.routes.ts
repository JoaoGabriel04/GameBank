import { Router } from "express";
import { authController, avatarProfileLimiter } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { avatarUpload } from "../../middleware/upload.middleware.js";

const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.get("/google", authController.google);
authRouter.get("/google/callback", authController.googleCallback);
authRouter.get("/discord", authController.discord);
authRouter.get("/discord/callback", authController.discordCallback);
authRouter.get("/me", authenticate, authController.me);
authRouter.post(
  "/profile",
  authenticate,
  avatarProfileLimiter,
  avatarUpload.single("avatar"),
  authController.completeProfile
);

export default authRouter;
