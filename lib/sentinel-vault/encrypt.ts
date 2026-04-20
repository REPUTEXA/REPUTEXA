import crypto from 'crypto';

/**
 * Format binaire (identique au flux fichier `gzip-encrypt-stream-file.ts`) :
 * IV 12 octets + tag d’authentification GCM 16 octets + ciphertext.
 */
export function encryptBufferAes256Gcm(plain: Buffer, key32: Buffer): Buffer {
  if (key32.length !== 32) throw new Error('SENTINEL_VAULT_AES_KEY doit dériver en 32 octets');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key32, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}
