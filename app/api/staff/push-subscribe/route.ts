import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10),
  }),
});

/** Enregistre la souscription Web Push (VAPID) pour alertes dispatch vocal (phase 2 : envoi serveur). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role !== 'merchant_staff') {
    return apiJsonError(request, 'forbidden', 403);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiJsonError(request, 'badRequest', 400);
  }

  const { endpoint, keys } = parsed.data;
  const ua = request.headers.get('user-agent') ?? '';

  const { error } = await supabase.from('merchant_staff_push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: ua.slice(0, 500),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id', ignoreDuplicates: false }
  );

  if (error) {
    console.error('[push-subscribe]', error.message);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({ ok: true });
}
