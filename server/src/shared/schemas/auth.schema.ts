import { z } from "zod";
import { isAllowedAvatarPreset } from "../constants/avatars.js";

const emailField = z
  .string()
  .email("Email inválido")
  .transform((value) => value.trim().toLowerCase());

export const RegisterSchema = z.object({
  email: emailField,
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const LoginSchema = z.object({
  email: emailField,
  senha: z.string().min(1, "Senha obrigatória"),
});

export const CompleteProfileSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Apelido obrigatório")
    .max(30, "Apelido deve ter no máximo 30 caracteres"),
  avatarPreset: z
    .string()
    .optional()
    .refine((v) => v === undefined || isAllowedAvatarPreset(v), "Avatar preset inválido"),
});
