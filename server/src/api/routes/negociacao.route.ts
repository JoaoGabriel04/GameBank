import {Router} from "express"
import negociacaoController from "../../modules/negociacao/negociacao.controller.js"
import { authenticate } from "../../middleware/auth.middleware.js"

const negociacaoRouter = Router();

negociacaoRouter.post('/criar', authenticate, negociacaoController.criar)
negociacaoRouter.post('/:id/aceitar', authenticate, negociacaoController.aceitar)
negociacaoRouter.post('/:id/recusar', authenticate, negociacaoController.recusar)
negociacaoRouter.post('/:id/contra-oferta', authenticate, negociacaoController.contraOfertar)
negociacaoRouter.get('/pendentes/:playerId', authenticate, negociacaoController.pendentes)

export default negociacaoRouter;
