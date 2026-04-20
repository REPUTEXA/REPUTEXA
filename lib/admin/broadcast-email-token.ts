import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  type LocalePack,
  broadcastPacksUnlockSnapshot,
  broadcastFrMasterUnlockSnapshot,
} from '@/lib/admin/broadcast-email-shared';

export type { LocalePack, BroadcastEmailLocale } from '@/lib/admin/broadcast-email-shared';
export {
  BROADCAST_EMAIL_LOCALES,
  normalizeLocalePacks,
  broadcastPacksUnlockSnapshot,
  broadcastFrMasterUnlockSnapshot,
} from '@/lib/admin/broadcast-email-shared';

export function fingerprintPacks(packs: Record<string, LocalePack>): string {
  return createHash('sha256').update(broadcastPacksUnlockSnapshot(packs)).digest('hex');
}

/** Jeton d’envoi global : sujet + corps FR uniquement (traductions calculées au « Envoyer à tous »). */
export function fingerprintFrMaster(subjectFr: string, htmlFr: string): string {
  return createHash('sha256').update(broadcastFrMasterUnlockSnapshot(subjectFr, htmlFr)).digest('hex');
}

export function signBroadcastSendToken(fingerprint: string, ttlSec = 3600): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET missing');
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = JSON.stringify({ fp: fingerprint, exp });
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyBroadcastSendToken(token: string, fingerprint: string): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = createHmac('sha256', secret).update(payloadB64!).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig!), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  let payload: { fp?: string; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  if (payload.fp !== fingerprint) return false;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return false;
  return true;
}
