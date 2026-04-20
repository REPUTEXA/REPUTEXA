import { z } from 'zod';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/;
/** Connexion par lien magique : email uniquement */
export const magicLinkLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'L\'email est requis')
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => EMAIL_REGEX.test(v), 'Format d\'email invalide'),
});

/** @deprecated Ancien schéma mot de passe — conservé si besoin d’outils internes */
export const loginSchema = magicLinkLoginSchema;

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
    /** Optionnels côté formulaire (support / conformité si besoin plus tard). */
    city: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : '')),
    postal_code: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? v.trim().replace(/\s/g, '') : '')),
    country: z
      .string()
      .min(1, 'Pays requis'),
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
  });

export type LoginInput = z.infer<typeof magicLinkLoginSchema>;
export type MagicLinkLoginInput = z.infer<typeof magicLinkLoginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
