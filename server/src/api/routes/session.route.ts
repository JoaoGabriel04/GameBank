import {Router} from "express"
import { sessionController } from "../../modules/session/session.controller.js"
import { authenticate } from "../../middleware/auth.middleware.js"
import { authenticateRoom } from "../../middleware/room-auth.middleware.js"

const sessionRouter = Router()

sessionRouter.get("/test", sessionController.test)
sessionRouter.get("/all-sessions", sessionController.get_sessions)

sessionRouter.post("/new-session", authenticate, sessionController.new_session)
sessionRouter.post("/:sessionId/join", authenticate, sessionController.join_session)
sessionRouter.post("/:sessionId/backfill-user", authenticate, sessionController.backfill_user)

sessionRouter.get("/my-active", authenticate, sessionController.my_active)

sessionRouter.post("/load-session/:sessionId", authenticate, authenticateRoom("params", "sessionId"), sessionController.load_session)
sessionRouter.post("/:sessionId/start", authenticate, authenticateRoom("params", "sessionId"), sessionController.start_session)

sessionRouter.post("/:sessionId/desistir", authenticate, authenticateRoom("params", "sessionId"), sessionController.desistir_session)
sessionRouter.post("/:sessionId/quit", authenticate, authenticateRoom("params", "sessionId"), sessionController.quit_session)
sessionRouter.get("/:sessionId/my-player", authenticate, sessionController.my_player)

sessionRouter.delete("/delete/:sessionId", authenticate, authenticateRoom("params", "sessionId"), sessionController.end_session)
sessionRouter.get("/:sessionId/resultado", authenticate, sessionController.get_resultado)

export default sessionRouter;
