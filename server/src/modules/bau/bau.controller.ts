import type { Request, Response } from "express"
import { BauService }       from "./bau.service.js"
import { AbrirBauSchema }   from "../../shared/schemas/bau.schema.js"
import { parseError }       from "../../middleware/error-handler.middleware.js"
import { emitToUser }       from "../../lib/socket.js"

const bauService = new BauService()

export const bauController = {
  listar: async (_req: Request, res: Response) => {
    try {
      const baus = await bauService.listar()
      res.json(baus)
    } catch (err) {
      parseError(res, err)
    }
  },

  abrir: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId
      const { tipo } = AbrirBauSchema.parse(req.params)

      const resultado = await bauService.abrir(userId, tipo)

      emitToUser(userId, "bau:aberto", resultado)

      res.json(resultado)
    } catch (err) {
      parseError(res, err)
    }
  },

  adquiridos: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId
      const lista = await bauService.listarAdquiridos(userId)
      res.json(lista)
    } catch (err) {
      parseError(res, err)
    }
  },

  abrirAdquirido: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId
      const id = Number(req.params.id)
      const resultado = await bauService.abrirAdquirido(userId, id)
      emitToUser(userId, "bau:aberto", resultado)
      res.json(resultado)
    } catch (err) {
      parseError(res, err)
    }
  },
}
