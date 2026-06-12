import {Router} from "express"
import { bancoController } from "../../modules/banco/banco.controller.js"
import { authenticate } from "../../middleware/auth.middleware.js"

const bancoRouter = Router();

bancoRouter.get("/test", bancoController.test)

bancoRouter.put('/deposito', authenticate, bancoController.deposito)
bancoRouter.put('/saque', authenticate, bancoController.saque)
bancoRouter.put('/transferencia', authenticate, bancoController.transferencia)
bancoRouter.put('/aluguel', authenticate, bancoController.pagarAluguel)
bancoRouter.put('/aluguelAcao', authenticate, bancoController.aluguelAcao)
bancoRouter.put('/receberDeTodos', authenticate, bancoController.receberDeTodos)

export default bancoRouter;