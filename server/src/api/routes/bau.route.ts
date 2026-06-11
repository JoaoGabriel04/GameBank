import { Router }        from "express"
import { authenticate }  from "../../middleware/auth.middleware.js"
import { bauController } from "../../modules/bau/bau.controller.js"

const router = Router()

router.get("/", bauController.listar)

router.post("/:tipo/abrir", authenticate, bauController.abrir)

router.get("/historico", authenticate, bauController.historico)

router.get("/adquiridos", authenticate, bauController.adquiridos)
router.post("/adquiridos/:id/abrir", authenticate, bauController.abrirAdquirido)

export { router as bauRouter }
