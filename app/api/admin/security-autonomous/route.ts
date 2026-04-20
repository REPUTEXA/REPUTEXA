import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadSecurityAutonomousConfig,
  saveSecurityAutonomousConfig,
  type SecurityAutonomousSchedule,
} from '@/lib/admin/security-autonomous-config';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export const dynamic = 'force-dynamic';

function validSchedule(s: unknown): s is SecurityAutonomousSchedule {
  return (
    s === 'off' ||
    s === 'hourly' ||
    s === 'daily_random' ||
    s === 'intensive_15m'
  );
}

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 }) };
  }
  return { admin };
}

export async function GET() {
  const r = await requireAdmin();
  if ('error' in r) return r.error;
  const config = await loadSecurityAutonomousConfig(r.admin);
  return NextResponse.json(config);
}

export async function PATCH(req: Request) {
  const r = await requireAdmin();
  if ('error' in r) return r.error;
  const ta = apiAdminT();
  const tApi = createServerTranslator('Api');

  let body: { schedule?: unknown; autoShield?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }
  const hasSchedule = body.schedule !== undefined;
  const hasAutoShield = body.autoShield !== undefined;
  if (!hasSchedule && !hasAutoShield) {
    return NextResponse.json({ error: tApi('errors.scheduleOrAutoShield') }, { status: 400 });
  }
  if (hasSchedule && !validSchedule(body.schedule)) {
    return NextResponse.json({ error: tApi('errors.scheduleEnumInvalid') }, { status: 400 });
  }

  const current = await loadSecurityAutonomousConfig(r.admin);
  const next = { ...current };
  if (hasSchedule) {
    next.schedule = body.schedule as SecurityAutonomousSchedule;
    if (next.schedule !== 'daily_random') {
      next.dailyRandomSlotMinutesUtc = null;
      next.lastDailyRandomDateUtc = null;
    }
  }
  if (hasAutoShield) {
    next.autoShield = body.autoShield === true;
  }
  await saveSecurityAutonomousConfig(r.admin, next);
  const saved = await loadSecurityAutonomousConfig(r.admin);
  return NextResponse.json(saved);
}
