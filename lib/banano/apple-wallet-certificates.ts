import { readFileSync, existsSync } from 'node:fs';
import { Buffer } from 'node:buffer';

export type AppleWalletCertificates = {
  wwdr: string | Buffer;
  signerCert: string | Buffer;
  signerKey: string | Buffer;
  signerKeyPassphrase?: string;
};

/**
 * Lit PEM / fichiers pour passkit-generator.
 * Variables :
 * - APPLE_WALLET_WWDR_PEM (contenu PEM) OU APPLE_WALLET_WWDR_PATH
 * - APPLE_WALLET_SIGNER_CERT_PEM OU APPLE_WALLET_SIGNER_CERT_PATH
 * - APPLE_WALLET_SIGNER_KEY_PEM OU APPLE_WALLET_SIGNER_KEY_PATH
 * - APPLE_WALLET_SIGNER_KEY_PASSPHRASE (optionnel)
 */
function readBase64Pem(envName: string): Buffer | null {
  const v = process.env[envName]?.trim();
  if (!v) return null;
  try {
    const buf = Buffer.from(v, 'base64');
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Clé privée Pass : PEM littéral, ou base64 (APPLE_PASS_PRIVATE_KEY / APPLE_PASS_PRIVATE_KEY_BASE64).
 */
function readApplePassPrivateKeyFromPlaceholderEnv(): string | Buffer | null {
  const raw = process.env.APPLE_PASS_PRIVATE_KEY?.trim();
  if (raw) {
    if (raw.includes('BEGIN')) return raw;
    try {
      const buf = Buffer.from(raw, 'base64');
      if (buf.length > 0) return buf;
    } catch {
      /* ignore */
    }
  }
  return readBase64Pem('APPLE_PASS_PRIVATE_KEY_BASE64');
}

/**
 * Charge WWDR + certificat signataire + clé.
 * Placeholders base64 : APPLE_PASS_CERTIFICATE_BASE64, APPLE_PASS_PRIVATE_KEY (ou …_BASE64), APPLE_WALLET_WWDR_BASE64.
 */
export function loadAppleWalletCertificatesFromEnv(): AppleWalletCertificates | null {
  const wwdr =
    readPemOrPath(process.env.APPLE_WALLET_WWDR_PEM, process.env.APPLE_WALLET_WWDR_PATH) ??
    readPemOrPath(undefined, process.env.APPLE_WWDR_CERT_PATH) ??
    readBase64Pem('APPLE_WALLET_WWDR_BASE64');

  const signerCertFromB64 = readBase64Pem('APPLE_PASS_CERTIFICATE_BASE64');
  const signerCert =
    signerCertFromB64 ??
    readPemOrPath(process.env.APPLE_WALLET_SIGNER_CERT_PEM, process.env.APPLE_WALLET_SIGNER_CERT_PATH) ??
    readPemOrPath(undefined, process.env.APPLE_PASS_CERT_PATH);

  const signerKeyFromPlaceholder = readApplePassPrivateKeyFromPlaceholderEnv();
  const signerKey =
    signerKeyFromPlaceholder ??
    readPemOrPath(process.env.APPLE_WALLET_SIGNER_KEY_PEM, process.env.APPLE_WALLET_SIGNER_KEY_PATH) ??
    readPemOrPath(undefined, process.env.APPLE_PASS_KEY_PATH);

  if (!wwdr || !signerCert || !signerKey) return null;

  const passphrase = (
    process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE ??
    process.env.APPLE_PASS_KEY_PASSPHRASE ??
    ''
  ).trim();

  return {
    wwdr,
    signerCert,
    signerKey,
    signerKeyPassphrase: passphrase.length > 0 ? passphrase : undefined,
  };
}

function readPemOrPath(pemEnv?: string, pathEnv?: string): Buffer | string | null {
  const p = pemEnv?.trim();
  if (p && p.includes('BEGIN')) {
    return p;
  }
  const filePath = pathEnv?.trim();
  if (filePath && existsSync(filePath)) {
    return readFileSync(filePath);
  }
  return null;
}

export function isAppleWalletSigningConfigured(): boolean {
  const passType = process.env.APPLE_PASS_TYPE_IDENTIFIER?.trim();
  const team = process.env.APPLE_TEAM_ID?.trim();
  if (!passType || !team) return false;
  return loadAppleWalletCertificatesFromEnv() != null;
}
