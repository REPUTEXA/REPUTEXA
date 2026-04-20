import type { NextResponse } from 'next/server';
import { GRAND_CENTRAL_BIND_COOKIE } from '@/lib/admin/grand-central-bind';
import { GRAND_CENTRAL_PING_DEDUPE_COOKIE } from '@/lib/admin/grand-central-ping';

/** Cookie `Secure` en prod ou sur Vercel (HTTPS). */
export function grandCentralCookieSecure(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

/** Efface les cookies Grand Central (logout / reset). */
export function clearGrandCentralCookies(response: NextResponse): void {
  const secure = grandCentralCookieSecure();
  for (const name of [GRAND_CENTRAL_BIND_COOKIE, GRAND_CENTRAL_PING_DEDUPE_COOKIE]) {
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
  }
}
