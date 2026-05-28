import { z } from 'zod';

export const DepositoSaqueSchema = z.object({
  userId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  valor: z.number().positive(),
});

export const TransferenciaSchema = z.object({
  pagadorId: z.number().int().positive(),
  recebedorId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  valor: z.number().positive(),
});

export const AluguelSchema = z.object({
  sessionId: z.number().int().positive(),
  pagadorId: z.number().int().positive(),
  sessionPossesId: z.number().int().positive(),
});

export const AluguelAcaoSchema = z.object({
  sessionId: z.number().int().positive(),
  pagadorId: z.number().int().positive(),
  sessionPossesId: z.number().int().positive(),
  numDados: z.number().int().positive(),
});

export const ReceberDeTodosSchema = z.object({
  sessionId: z.number().int().positive(),
  userId: z.number().int().positive(),
});
