import {Router} from "express"
import propsController from "../../modules/propriedade/propriedade.controller.js";

const propRouter = Router();

propRouter.get("/getById/:propriedadeId", propsController.getPropById)

propRouter.put('/buyProp', propsController.buyProp)
propRouter.put('/sellProp', propsController.sellPropriedade)
propRouter.put('/hipotecar', propsController.hipotecarPropriedade)
propRouter.put('/buyHouse', propsController.buyHouse)
propRouter.put('/sellHouse', propsController.sellHouse)
propRouter.put('/trocar', propsController.trocarPropriedade)
propRouter.put('/comprar-hipotecada', propsController.comprarHipotecada)
propRouter.put('/responder-notificacao/:id', propsController.responderNotificacao)

export default propRouter;