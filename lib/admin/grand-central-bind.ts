import type { NextRequest } from 'next/server';

export const GRAND_CENTRAL_BIND_COOKIE = 'grand_central_bind';

/**
 * Empreinte volontairement limitée aux en-têtes courants (pas d’IP : déjà gérée par ADMIN_ALLOWED_IPS).
 */
export function grandCentralClientFingerprint(request: NextRequest): string {
  const ua = request.headers.get('user-agent') ?? '';
  const lang = request.headers.get('accept-language') ?? '';
  const chUa = request.headers.get('sec-ch-ua') ?? '';
  const platform = request.headers.get('sec-ch-ua-platform') ?? '';
  return [ua, lang, chUa, platform].join('\n');
}

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signGrandCentralBind(userId: string, fingerprint: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payload = `${userId}\n${fingerprint}`;
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return arrayBufferToBase64Url(sig);
}
