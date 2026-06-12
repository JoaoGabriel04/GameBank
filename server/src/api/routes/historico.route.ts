import {Router} from "express"
import { historicoController } from "../../modules/historico/historico.controller.js";

const histRouter = Router();

histRouter.get("/test", historicoController.test)
histRouter.get("/all/:id", historicoController.all)

export default histRouter;