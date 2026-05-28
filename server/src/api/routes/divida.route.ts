import { Router } from "express";
import dividaController from "../../modules/divida/divida.controller.js";

const dividaRouter = Router();

dividaRouter.get("/:sessionId/:playerId", dividaController.listarPendentes);
dividaRouter.put("/pagar/:debtId", dividaController.pagarDivida);

export default dividaRouter;
