import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

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

  if ((profile as { role?: string } | null)?.role === 'merchant_staff') {
    return apiJsonError(request, 'forbidden', 403);
  }

  const body = await request.json().catch(() => ({}));
  const month = typeof body?.month === 'string' ? body.month.trim() : '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return apiJsonError(request, 'badRequest', 400);
  }

  const markedAt = new Date().toISOString();
  const { error } = await supabase.from('banano_loyalty_flow_month_markers').upsert(
    { user_id: user.id, month_ym: month, marked_at: markedAt },
    { onConflict: 'user_id,month_ym', ignoreDuplicates: false }
  );

  if (error) {
    console.error('[transaction-flow archive-mark]', error.message);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({
    ok: true,
    month,
    markedAt,
  });
}
