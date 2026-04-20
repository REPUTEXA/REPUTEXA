import { apiJsonError, apiJsonMessage } from '@/lib/api/api-error-response';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { checkClientDataErasureRateLimit } from '@/lib/rate-limit';
import { purgeEndClientDataByPhone } from '@/lib/end-client-erasure';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/client-data-erasure
 * Demande d’effacement pour un client final (sans compte REPUTEXA), hors WhatsApp.
 * Ne divulgue pas si des données existaient : réponse générique en cas de succès.
 */
export async function POST(request: Request) {
  const rl = checkClientDataErasureRateLimit(request);
  if (!rl.ok) {
    return apiJsonError(request, 'publicErasure_rateLimit', 429);
  }

  const body = await request.json().catch(() => ({}));
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

  if (!phone) {
    return apiJsonError(request, 'publicErasure_phoneRequired', 400);
  }

  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    if (!token) {
      return apiJsonError(request, 'publicErasure_turnstileRequired', 400);
    }
    const ok = await verifyTurnstileToken(token);
    if (!ok) {
      return apiJsonError(request, 'publicErasure_turnstileFailed', 400);
    }
  }

  try {
    await purgeEndClientDataByPhone(phone);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'INVALID_PHONE') {
      return apiJsonError(request, 'publicErasure_invalidPhoneDetail', 400);
    }
    if (msg === 'SERVICE_UNAVAILABLE') {
      return apiJsonError(request, 'publicErasure_serviceUnavailable', 503);
    }
    console.error('[client-data-erasure]', err);
    return apiJsonError(request, 'publicErasure_server', 500);
  }

  return apiJsonMessage(request, 'publicErasure_successMessage', 200);
}
