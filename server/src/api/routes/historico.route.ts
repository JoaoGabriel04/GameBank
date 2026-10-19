import {Router} from "express"
import { historicoController } from "../../modules/historico/historico.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authenticateRoom } from "../../middleware/room-auth.middleware.js";

const histRouter = Router();

histRouter.get("/test", historicoController.test)
// Histórico completo da partida, paginado (?limite=&antesDe=<id>). Exige
// login e acesso à sala — o antigo /all/:id era público.
histRouter.get("/:sessionId", authenticate, authenticateRoom("params", "sessionId"), historicoController.listar)

export default histRouter;
