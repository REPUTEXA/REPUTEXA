import { z } from 'zod';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72;

/** Schéma de validation pour le formulaire de connexion */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'L\'email est requis')
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => EMAIL_REGEX.test(v), 'Format d\'email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

/** Schéma de validation pour le formulaire d'inscription */
export const signupSchema = z
  .object({
    fullName: z
      .string()
      .min(1, 'Le prénom/nom est requis')
      .transform((v) => v.trim())
      .refine((v) => v.length >= 2, 'Minimum 2 caractères'),
    establishmentName: z
      .string()
      .min(1, 'Le nom de l\'établissement est requis')
      .transform((v) => v.trim())
      .refine((v) => v.length >= 2, 'Minimum 2 caractères'),
    establishmentType: z
      .string()
      .min(1, 'Le type d\'établissement est requis')
      .transform((v) => v.trim())
      .refine((v) => v.length >= 2, 'Minimum 2 caractères'),
    address: z.string().optional(),
    phone: z
      .string()
      .optional()
      .refine(
        (v) => !v || v.trim() === '' || PHONE_E164_REGEX.test(v.replace(/\s/g, '')),
        'Format de numéro invalide'
      ),
    email: z
      .string()
      .min(1, 'L\'email est requis')
      .transform((v) => v.trim().toLowerCase())
      .refine((v) => EMAIL_REGEX.test(v), 'Format d\'email invalide'),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Minimum ${MIN_PASSWORD_LENGTH} caractères`)
      .max(MAX_PASSWORD_LENGTH, `Maximum ${MAX_PASSWORD_LENGTH} caractères`),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Les deux mots de passe ne correspondent pas',
    path: ['passwordConfirm'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
