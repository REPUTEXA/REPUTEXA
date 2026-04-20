import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

const bodySchema = z.object({
  taskRef: z.string().min(1).max(200),
  source: z.enum(['manual', 'dispatch', 'other']).optional(),
});

/**
 * Enregistre une tâche complétée (mission / dispatch) pour le salarié connecté.
 * Alimente le compteur « tâches cette semaine » sur le dashboard équipe.
 */
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

  const { taskRef, source } = parsed.data;
  const src = source ?? 'manual';

  const { data: membership, error: memErr } = await supabase
    .from('merchant_team_members')
    .select('merchant_user_id, status')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (memErr || !membership) {
    return apiJsonError(request, 'forbidden', 403);
  }

  const merchantUserId = String((membership as { merchant_user_id: string }).merchant_user_id);

  const { error: insErr } = await supabase.from('merchant_staff_task_completions').insert({
    merchant_user_id: merchantUserId,
    staff_user_id: user.id,
    task_ref: taskRef,
    source: src,
  });

  if (insErr) {
    console.error('[staff/tasks/complete]', insErr.message);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({ ok: true });
}
