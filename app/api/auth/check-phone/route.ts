import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhoneForUniqueness } from '@/lib/auth/normalize-phone';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { apiJsonError } from '@/lib/api/api-error-response';

/**
 * Vérifie si un numéro de téléphone est déjà associé à un compte (unicité).
 * Rate limit: 5 req/min par IP.
 */
export async function POST(request: Request) {
  try {
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.ok) {
      return apiJsonError(request, 'auth_rateLimit', 429);
    }

    const body = await request.json().catch(() => ({}));
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (!phone) {
      return NextResponse.json({ available: true });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ available: true });
    }

    const normalizedInput = normalizePhoneForUniqueness(phone);
    if (!normalizedInput || normalizedInput.length < 9) {
      return NextResponse.json({ available: true });
    }

    const { data: profiles } = await admin
      .from('profiles')
      .select('phone, whatsapp_phone');

    const exists = (profiles ?? []).some((p) => {
      const p1 = p.phone ? normalizePhoneForUniqueness(String(p.phone)) : '';
      const p2 = p.whatsapp_phone ? normalizePhoneForUniqueness(String(p.whatsapp_phone)) : '';
      return (p1 && p1 === normalizedInput) || (p2 && p2 === normalizedInput);
    });

    return NextResponse.json({ available: !exists });
  } catch {
    return NextResponse.json({ available: true });
  }
}
