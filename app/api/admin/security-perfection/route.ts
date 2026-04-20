import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  appendActivity,
  loadSecurityPerfectionState,
  patchSecurityPerfectionState,
  saveSecurityPerfectionState,
} from '@/lib/admin/security-perfection-state';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: ta('adminOnly') }, { status: 403 }) };
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
  const state = await loadSecurityPerfectionState(r.admin);
  const sv = await r.admin
    .from('sentinel_vault_runs')
    .select('run_at, status, error_message, s3_key_daily, s3_key_monthly, bytes_encrypted, duration_ms')
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sv.error) {
    console.warn('[security-perfection] sentinel_vault_runs', sv.error.message);
  }
  const svHist = await r.admin
    .from('sentinel_vault_runs')
    .select(
      'run_at, status, error_message, s3_key_daily, s3_key_monthly, bytes_plain, bytes_gzip, bytes_encrypted, duration_ms'
    )
    .order('run_at', { ascending: false })
    .limit(12);
  if (svHist.error) {
    console.warn('[security-perfection] sentinel_vault_runs history', svHist.error.message);
  }
  const sentinelVault = sv.error ? null : sv.data;
  return NextResponse.json({
    ...state,
    sentinelVault: sentinelVault ?? null,
    sentinelVaultHistory: svHist.error ? [] : (svHist.data ?? []),
  });
}

export async function PATCH(req: Request) {
  const r = await requireAdmin();
  if ('error' in r) return r.error;
  const ta = apiAdminT();

  let body: { godMode?: boolean; killSwitch?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  let state = await loadSecurityPerfectionState(r.admin);
  const prevKill = state.killSwitch;
  const prevGod = state.godMode;

  if (typeof body.godMode === 'boolean' || typeof body.killSwitch === 'boolean') {
    state = patchSecurityPerfectionState(state, {
      godMode: typeof body.godMode === 'boolean' ? body.godMode : undefined,
      killSwitch: typeof body.killSwitch === 'boolean' ? body.killSwitch : undefined,
    });
  }

  const entries: Parameters<typeof appendActivity>[1] = [];
  if (typeof body.killSwitch === 'boolean' && body.killSwitch !== prevKill) {
    entries.push({
      at: new Date().toISOString(),
      kind: 'kill',
      message: body.killSwitch ? ta('securityPerfectionKillSwitchActivated') : ta('securityPerfectionKillSwitchDeactivated'),
    });
  }
  if (typeof body.godMode === 'boolean' && body.godMode !== prevGod && !state.killSwitch) {
    entries.push({
      at: new Date().toISOString(),
      kind: 'god',
      message: body.godMode ? ta('securityPerfectionGodModeActivated') : ta('securityPerfectionGodModeDeactivated'),
    });
  }

  if (entries.length) {
    state = appendActivity(state, entries);
  }
  await saveSecurityPerfectionState(r.admin, state);
  return NextResponse.json(state);
}
