import {Router} from "express"
import negociacaoController from "../../modules/negociacao/negociacao.controller.js"

const negociacaoRouter = Router();

negociacaoRouter.post('/criar', negociacaoController.criar)
negociacaoRouter.post('/:id/aceitar', negociacaoController.aceitar)
negociacaoRouter.post('/:id/recusar', negociacaoController.recusar)
negociacaoRouter.post('/:id/contra-oferta', negociacaoController.contraOfertar)
negociacaoRouter.get('/pendentes/:playerId', negociacaoController.pendentes)

export default negociacaoRouter;
