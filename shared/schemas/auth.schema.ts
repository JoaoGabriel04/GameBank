import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  nome: z.string().min(1, 'Nome obrigatório').max(100).trim(),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha obrigatória'),
});
