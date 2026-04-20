import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiJsonError } from '@/lib/api/api-error-response';
import { utcDayStartIso, utcMondayWeekStartIso } from '@/lib/team/team-member-stats';

export async function GET(request: Request) {
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

  const { data: rows, error } = await supabase
    .from('merchant_team_members')
    .select('id, member_user_id, role, status, created_at, last_seen_at')
    .eq('merchant_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[team/members]', error.message);
    return apiJsonError(request, 'serverError', 500);
  }

  const admin = createAdminClient();
  const memberIds = (rows ?? []).map((r) => (r as { member_user_id: string }).member_user_id);

  const names: Record<string, string> = {};
  if (admin && memberIds.length > 0) {
    const { data: profs } = await admin.from('profiles').select('id, full_name, email').in('id', memberIds);
    for (const p of profs ?? []) {
      const pr = p as { id: string; full_name: string | null; email: string | null };
      names[pr.id] = (pr.full_name && pr.full_name.trim()) || pr.email || pr.id.slice(0, 8);
    }
  }

  const dayStart = utcDayStartIso();
  const weekStart = utcMondayWeekStartIso();
  const scanCounts: Record<string, number> = {};
  const taskCounts: Record<string, number> = {};

  if (admin && memberIds.length > 0) {
    await Promise.all(
      memberIds.map(async (mid) => {
        const { count: sc } = await admin
          .from('banano_loyalty_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('processed_by_user_id', mid)
          .gte('created_at', dayStart);
        scanCounts[mid] = sc ?? 0;
      })
    );
    await Promise.all(
      memberIds.map(async (mid) => {
        const { count: tc } = await admin
          .from('merchant_staff_task_completions')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_user_id', user.id)
          .eq('staff_user_id', mid)
          .gte('completed_at', weekStart);
        taskCounts[mid] = tc ?? 0;
      })
    );
  }

  const enriched = (rows ?? []).map((r) => {
    const row = r as {
      id: string;
      member_user_id: string;
      role: string;
      status: string;
      created_at: string;
      last_seen_at: string | null;
    };
    const mid = row.member_user_id;
    return {
      ...row,
      displayName: names[mid] ?? mid.slice(0, 8),
      tasksCompletedWeek: taskCounts[mid] ?? 0,
      walletScansToday: scanCounts[mid] ?? 0,
    };
  });

  return NextResponse.json({ members: enriched });
}
