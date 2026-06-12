import { Router } from "express"
import adminRouter from "./admin.route.js"
import sessionRouter from "./session.route.js"
import propRouter from "./propriedade.route.js"
import userRouter from "./user.route.js"
import histRouter from "./historico.route.js"
import bancoRouter from "./banco.route.js"
import cartaRouter from "./carta.route.js"
import negociacaoRouter from "./negociacao.route.js"
import dividaRouter from "./divida.route.js"
import authRouter from "./auth.route.js"
import profileRouter from "./profile.route.js"
import missionsRouter from "./missions.route.js"
import shopRouter from "./shop.route.js"
import rankingRouter from "./ranking.route.js"
import bannerRouter from "./banner.route.js"
import diamondsRouter from "./diamonds.routes.js"
import bauRouter from "./bau.route.js"

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
apiRouter.use("/profile", profileRouter)
apiRouter.use("/missions", missionsRouter)
apiRouter.use("/shop", shopRouter)
apiRouter.use("/ranking", rankingRouter)
apiRouter.use("/banners", bannerRouter)
apiRouter.use("/admin", adminRouter)
apiRouter.use("/diamonds", diamondsRouter)
apiRouter.use("/baus", bauRouter)

export default apiRouter