import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 32;

/** Format : scrypt$<salt_hex>$<hash_hex> */
export function hashBananoPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin.normalize('NFKC'), salt, KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyBananoPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const [, saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const hash = scryptSync(pin.normalize('NFKC'), salt, expected.length, SCRYPT_PARAMS);
    return hash.length === expected.length && timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}

export function assertPinFormat(pin: string): void {
  const p = pin.trim();
  if (p.length < 4 || p.length > 8) {
    throw new Error('Le code doit contenir entre 4 et 8 caractères.');
  }
  if (!/^\d+$/.test(p)) {
    throw new Error('Utilisez uniquement des chiffres (code PIN).');
  }
}

/** PIN équipier terminal : exactement 4 chiffres (distinct du PIN patron 4–8). */
export function assertStaffTerminalPinFormat(pin: string): void {
  const p = pin.trim();
  if (!/^\d{4}$/.test(p)) {
    throw new Error('Le code équipier doit comporter exactement 4 chiffres (unique par personne).');
  }
}
