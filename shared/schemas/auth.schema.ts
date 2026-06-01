import { z } from 'zod';
import { isAllowedAvatarPreset } from '../constants/avatars.js';

export const CompleteProfileSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Apelido obrigatório')
    .max(30, 'Apelido deve ter no máximo 30 caracteres'),
  avatarPreset: z
    .string()
    .optional()
    .refine((v) => v === undefined || isAllowedAvatarPreset(v), 'Avatar preset inválido'),
});
