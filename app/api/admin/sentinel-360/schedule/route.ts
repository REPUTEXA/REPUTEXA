import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import {
  loadSentinel360Config,
  saveSentinel360Config,
  type Sentinel360AutoFrequency,
} from '@/lib/admin/sentinel-360-audit';

export const dynamic = 'force-dynamic';

function isValidFrequency(v: unknown): v is Sentinel360AutoFrequency {
  return v === 'off' || v === 'daily' || v === 'weekly';
}

export async function GET() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });

  const config = await loadSentinel360Config(admin);
  return NextResponse.json(config);
}

export async function PATCH(req: Request) {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }
  const raw = (body as { autoFrequency?: unknown }).autoFrequency;
  if (!isValidFrequency(raw)) {
    return NextResponse.json({ error: ta('sentinel360AutoFrequencyInvalid') }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });

  const config = await saveSentinel360Config(admin, { autoFrequency: raw });
  return NextResponse.json(config);
}
