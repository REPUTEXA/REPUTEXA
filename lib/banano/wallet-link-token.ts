import { createHmac, timingSafeEqual } from 'crypto';

const SEP = '.';

export type WalletLinkPayload = {
  m: string;
  u: string;
  exp: number;
};

function b64url(buf: Buffer): string {
  return buf.toString('base64url').replace(/=/g, '');
}

function fromB64url(s: string): Buffer {
  const pad = 4 - (s.length % 4 || 4);
  const padded = pad === 4 ? s : s + '='.repeat(pad);
  return Buffer.from(padded, 'base64url');
}

export function signWalletLinkPayload(payload: WalletLinkPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = createHmac('sha256', secret).update(body).digest();
  return `${body}${SEP}${b64url(sig)}`;
}

export function verifyWalletLinkToken(
  token: string,
  secret: string
): WalletLinkPayload | null {
  const parts = token.split(SEP);
  if (parts.length !== 2) return null;
  const [body, sigB64] = parts;
  if (!body || !sigB64) return null;
  let sig: Buffer;
  try {
    sig = fromB64url(sigB64);
  } catch {
    return null;
  }
  const expected = createHmac('sha256', secret).update(body).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const m = typeof p.m === 'string' ? p.m : '';
  const u = typeof p.u === 'string' ? p.u : '';
  const exp = typeof p.exp === 'number' ? p.exp : 0;
  if (!m || !u || exp < Date.now() / 1000) return null;
  return { m, u, exp };
}
