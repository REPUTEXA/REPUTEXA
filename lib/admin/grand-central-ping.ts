import type { NextRequest, NextResponse } from 'next/server';
import { getGrandCentralClientIp } from '@/lib/admin/grand-central-ip';
import { localeForGrandCentralRequest } from '@/lib/admin/grand-central-locale';

/** Anti-bruit : une alerte / 90s par (type, IP) environ. */
export const GRAND_CENTRAL_PING_DEDUPE_COOKIE = 'gc_intrusion_slot';

const DEDUPE_WINDOW_MS = 90_000;

export function grandCentralPingDedoupeValue(kind: string, ip: string | null): string {
  const slot = Math.floor(Date.now() / DEDUPE_WINDOW_MS);
  return `${kind}|${ip ?? 'unknown'}|${slot}`;
}

export function shouldSkipGrandCentralIntrusionPing(request: NextRequest, kind: string): boolean {
  const ip = getGrandCentralClientIp(request);
  const expected = grandCentralPingDedoupeValue(kind, ip);
  return request.cookies.get(GRAND_CENTRAL_PING_DEDUPE_COOKIE)?.value === expected;
}

export function applyGrandCentralPingDedupeCookie(response: NextResponse, request: NextRequest, kind: string): void {
  const ip = getGrandCentralClientIp(request);
  const val = grandCentralPingDedoupeValue(kind, ip);
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  response.cookies.set(GRAND_CENTRAL_PING_DEDUPE_COOKIE, val, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.ceil(DEDUPE_WINDOW_MS / 1000) + 30,
    secure,
  });
}

/**
 * Signale une tentative refusée (middleware Edge) vers la route Node interne.
 */
export function fireGrandCentralIntrusionPing(request: NextRequest, kind: string, pathname: string): void {
  const secret = process.env.GRAND_CENTRAL_ALERT_SECRET?.trim();
  if (!secret) return;
  const url = new URL('/api/internal/grand-central-intrusion', request.nextUrl.origin);
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      kind,
      pathname,
      ip: getGrandCentralClientIp(request),
      ua_tail: request.headers.get('user-agent')?.slice(0, 240) ?? null,
      locale: localeForGrandCentralRequest(request),
    }),
  }).catch(() => {});
}
