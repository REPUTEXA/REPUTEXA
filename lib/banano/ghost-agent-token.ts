import { createHash, randomBytes } from 'crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Secret affiché une seule fois au commerçant ; stocker uniquement le hash en base. */
export function generateGhostAgentPlainToken(): string {
  return `rgx_${randomBytes(32).toString('base64url').replace(/=/g, '')}`;
}
