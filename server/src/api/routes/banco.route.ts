import {Router} from "express"
import bancoController from "../../modules/banco/banco.controller.js"

const bancoRouter = Router();

bancoRouter.get("/test", bancoController.test)

bancoRouter.put('/deposito', bancoController.deposito)
bancoRouter.put('/saque', bancoController.saque)
bancoRouter.put('/transferencia', bancoController.transferencia)
bancoRouter.put('/aluguel', bancoController.pagarAluguel)
bancoRouter.put('/aluguelAcao', bancoController.aluguelAcao)
bancoRouter.put('/receberDeTodos', bancoController.receberDeTodos)

export default bancoRouter;