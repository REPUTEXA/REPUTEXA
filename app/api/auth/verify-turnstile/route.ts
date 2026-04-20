import { NextResponse } from 'next/server';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { apiJsonError } from '@/lib/api/api-error-response';

/**
 * Vérifie le token Turnstile et applique le rate limiting.
 * POST { turnstileToken: string, action?: 'login' | 'signup' } → { ok: boolean }
 */
export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request);
  if (!rateLimit.ok) {
    return apiJsonError(request, 'authTurnstile_rateLimit', 429);
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

  if (!token) {
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      return apiJsonError(request, 'authTurnstile_captchaRequired', 400);
    }
    return NextResponse.json({ ok: true });
  }

  const valid = await verifyTurnstileToken(token);
  if (!valid) {
    return apiJsonError(request, 'authTurnstile_failed', 400);
  }

  return NextResponse.json({ ok: true });
}
