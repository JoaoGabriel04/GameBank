import {Router} from "express"
import sessionRouter from "./session.route.js"
import propRouter from "./propriedade.route.js"
import userRouter from "./user.route.js"
import histRouter from "./historico.route.js"
import bancoRouter from "./banco.route.js"
import cartaRouter from "./carta.route.js"
import negociacaoRouter from "./negociacao.route.js"
import dividaRouter from "./divida.route.js"
import authRouter from "../../modules/auth/auth.routes"

const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/sessions", sessionRouter)
apiRouter.use("/propriedades", propRouter)
apiRouter.use("/user", userRouter)
apiRouter.use("/historico", histRouter)
apiRouter.use("/banco", bancoRouter)
apiRouter.use("/cartas", cartaRouter)
apiRouter.use("/negociacoes", negociacaoRouter)
apiRouter.use("/dividas", dividaRouter)

export default apiRouter