import { z } from "zod"

export const AbrirBauSchema = z.object({
  tipo: z.enum(["comum", "premium", "lendario"]),
})

export type AbrirBauInput = z.infer<typeof AbrirBauSchema>
