import { z } from 'zod';

export const BuyPropSchema = z.object({
  propriedadeId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export const HouseOperationSchema = z.object({
  userId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  propriedadeId: z.number().int().positive(),
});

export const TrocaPropSchema = z.object({
  propriedadeId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export const ComprarHipotecadaSchema = z.object({
  sessionPossesId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  compradorId: z.number().int().positive(),
});

export const ResponderNotificacaoSchema = z.object({
  aceitar: z.boolean(),
  respondedorId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
});
