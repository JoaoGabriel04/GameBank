import { z } from "zod"

export const AbrirBauSchema = z.object({
  tipo: z.enum(["comum", "premium", "lendario"]),
})

export type AbrirBauInput = z.infer<typeof AbrirBauSchema>

export const AbrirMultiploBauSchema = z.object({
  tipo: z.enum(["comum", "premium", "lendario"]),
  quantidade: z.coerce.number().int().min(2).max(50),
})

export type AbrirMultiploBauInput = z.infer<typeof AbrirMultiploBauSchema>
