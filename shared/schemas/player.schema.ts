import { z } from 'zod';

export const PlayerColorEnum = z.enum([
  'red', 'blue', 'green', 'yellow', 'purple', 'black', 'orange', 'pink', 'emerald'
]);

export const CreatePlayerSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(50).trim(),
  cor: PlayerColorEnum,
  saldo: z.number().min(0).default(25000),
});

export const EditPlayerSchema = z.object({
  nome: z.string().min(1).max(50).trim().optional(),
  cor: PlayerColorEnum.optional(),
});
