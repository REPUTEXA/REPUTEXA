import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('banano_flow_auto_archive_monthly, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    return apiJsonError(request, 'serverError', 500);
  }

  if ((profile as { role?: string }).role === 'merchant_staff') {
    return apiJsonError(request, 'forbidden', 403);
  }

  return NextResponse.json({
    autoArchiveMonthly: (profile as { banano_flow_auto_archive_monthly?: boolean }).banano_flow_auto_archive_monthly === true,
  });
}

export async function PATCH(request: Request) {
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
  const raw = body?.autoArchiveMonthly;
  if (typeof raw !== 'boolean') {
    return apiJsonError(request, 'badRequest', 400);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ banano_flow_auto_archive_monthly: raw })
    .eq('id', user.id);

  if (error) {
    console.error('[transaction-flow settings]', error.message);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({ ok: true, autoArchiveMonthly: raw });
}
