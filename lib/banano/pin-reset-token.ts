import { createHash, randomBytes } from 'crypto';

export const PIN_RESET_TOKEN_BYTES = 32;
/** Durée de validité du lien envoyé par e-mail */
export const PIN_RESET_TTL_MS = 60 * 60 * 1000;

export function generatePinResetSecret(): string {
  return randomBytes(PIN_RESET_TOKEN_BYTES).toString('base64url');
}

export function hashPinResetToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}
