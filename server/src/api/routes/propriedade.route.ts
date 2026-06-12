import {Router} from "express"
import { propsController } from "../../modules/propriedade/propriedade.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js"

const propRouter = Router();

propRouter.get("/getById/:propriedadeId", authenticate, propsController.getPropById)

propRouter.put('/buyProp', authenticate, propsController.buyProp)
propRouter.put('/sellProp', authenticate, propsController.sellPropriedade)
propRouter.put('/hipotecar', authenticate, propsController.hipotecarPropriedade)
propRouter.put('/buyHouse', authenticate, propsController.buyHouse)
propRouter.put('/buyHousesBatch', authenticate, propsController.buyHousesBatch)
propRouter.put('/sellHousesBatch', authenticate, propsController.sellHousesBatch)
propRouter.put('/sellHouse', authenticate, propsController.sellHouse)
propRouter.put('/trocar', authenticate, propsController.trocarPropriedade)
propRouter.put('/comprar-hipotecada', authenticate, propsController.comprarHipotecada)
propRouter.put('/responder-notificacao/:id', authenticate, propsController.responderNotificacao)

export default propRouter;