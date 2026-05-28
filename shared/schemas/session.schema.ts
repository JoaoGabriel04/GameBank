import { z } from 'zod';
import { CreatePlayerSchema } from './player.schema';

export const CreateTeamSchema = z.object({
  nome: z.string().min(1).max(50).trim(),
  cor: z.string().min(1).max(20).trim(),
});

export const CreateSessionSchema = z.object({
  nome: z.string().min(1).max(100).trim().optional(),
  senha: z.string().min(4).max(100).optional(),
  modo: z.enum(["individual", "duplas"]).default("individual"),
  maxJogadores: z.number().int().min(2).max(12).default(6),
  saldoInicial: z.number().min(1000).default(25000),
  times: z.array(CreateTeamSchema).min(2).max(6).optional(),
  criadorNome: z.string().min(1).max(50).trim(),
  criadorCor: z.string().min(1).max(20).trim(),
  criadorTeamIndex: z.number().int().optional(),
});

export const JoinSessionSchema = z.object({
  senha: z.string().min(1).optional(),
  nome: z.string().min(1).max(50).trim(),
  cor: z.string().min(1).max(20).trim(),
  teamId: z.number().int().optional(),
});

export const StartSessionSchema = z.object({
  sessionId: z.number().int(),
});
