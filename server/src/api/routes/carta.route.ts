import {Router} from "express"
import { cartaController } from "../../modules/carta/carta.controller.js"

const cartaRouter = Router();

cartaRouter.post('/sortear', cartaController.sortearCarta)
cartaRouter.post('/usar-prisao', cartaController.usarCartaPrisao)
cartaRouter.get('/:sessionId', cartaController.listarCartas)

export default cartaRouter;
