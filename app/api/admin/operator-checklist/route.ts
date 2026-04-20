import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  appendLog,
  buildSnapshot,
  loadOperatorChecklist,
  mergeOperatorChecklistPatch,
  normalizeOperatorChecklist,
  resetOperatorChecklistPeriod,
  saveOperatorChecklist,
  ID_SET,
  type OperatorChecklistId,
  type OperatorChecklistLogEntry,
} from '@/lib/admin/admin-operator-checklist';
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
  const state = await loadOperatorChecklist(r.admin);
  return NextResponse.json(state);
}

export async function PATCH(req: Request) {
  const r = await requireAdmin();
  if ('error' in r) return r.error;
  const ta = apiAdminT();

  let body: {
    checked?: Partial<Record<OperatorChecklistId, boolean>>;
    reset?: 'daily' | 'weekly' | 'monthly';
    archiveSnapshot?: boolean;
    snapshotNote?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  let state = normalizeOperatorChecklist(await loadOperatorChecklist(r.admin));
  const logBatch: OperatorChecklistLogEntry[] = [];
  const now = () => new Date().toISOString();

  if (body.archiveSnapshot === true) {
    const snap = buildSnapshot(state, body.snapshotNote ?? null);
    state = {
      ...state,
      snapshots: [...state.snapshots, snap].slice(-48),
      updatedAt: now(),
    };
    logBatch.push({
      at: now(),
      kind: 'archive_snapshot',
      note: snap.note,
      summary: `${snap.doneCount}/${snap.totalSlots}`,
    });
  }

  if (body.reset === 'daily' || body.reset === 'weekly' || body.reset === 'monthly') {
    state = resetOperatorChecklistPeriod(state, body.reset);
    const kind =
      body.reset === 'daily' ? 'reset_daily' : body.reset === 'weekly' ? 'reset_weekly' : 'reset_monthly';
    logBatch.push({ at: now(), kind });
  }

  if (body.checked && typeof body.checked === 'object') {
    const before = { ...state.checked };
    for (const [k, v] of Object.entries(body.checked)) {
      if (!ID_SET.has(k)) continue;
      const id = k as OperatorChecklistId;
      const was = before[id] === true;
      if (v === true && !was) {
        logBatch.push({ at: now(), kind: 'check', itemId: id });
      }
      if (v === false && was) {
        logBatch.push({ at: now(), kind: 'uncheck', itemId: id });
      }
    }
    state = mergeOperatorChecklistPatch(state, body.checked);
  }

  state = appendLog(state, logBatch);
  state = normalizeOperatorChecklist(state);
  await saveOperatorChecklist(r.admin, state);
  return NextResponse.json(state);
}
