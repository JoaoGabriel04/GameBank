import {Router} from "express"
import userController from "../../modules/user/user.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const userRouter = Router();

userRouter.get("/getById/:playerId", userController.getById)

userRouter.put("/editPlayer/:playerId", authenticate, userController.editPlayer)

userRouter.delete("/removePlayer/:playerId", authenticate, userController.removePlayer)

export default userRouter;