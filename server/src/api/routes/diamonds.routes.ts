import { Router } from "express"
import { authenticate } from "../../middleware/auth.middleware.js"
import { diamondPublicController } from "../../modules/diamonds/diamond-public.controller.js"

const router = Router()

router.get("/packages", diamondPublicController.listPackages)
router.post("/checkout", authenticate, diamondPublicController.checkout)
router.get("/balance", authenticate, diamondPublicController.balance)
router.get("/history", authenticate, diamondPublicController.history)

export default router
