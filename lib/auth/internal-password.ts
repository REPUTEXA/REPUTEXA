import { randomBytes } from 'crypto';

/** Mot de passe jamais communiqué au client — requis par l’API Admin Supabase uniquement. */
export function generateInternalUserPassword(): string {
  return randomBytes(48).toString('base64url');
}
