import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

type Ctx = { params: Promise<{ memberId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { memberId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const body = await request.json().catch(() => ({}));
  const roleRaw = body.role;
  const hasRole =
    roleRaw === 'manager' || roleRaw === 'staff';
  const role = hasRole ? (roleRaw === 'manager' ? 'manager' : 'staff') : null;
  const hasLink = Object.prototype.hasOwnProperty.call(body, 'linkTerminalStaffId');
  const linkTerminalStaffId =
    typeof body.linkTerminalStaffId === 'string' ? body.linkTerminalStaffId.trim() : null;

  if (!hasRole && !hasLink) {
    return apiJsonError(request, 'badRequest', 400);
  }

  const { data: row, error: selErr } = await supabase
    .from('merchant_team_members')
    .select('id, member_user_id')
    .eq('id', memberId)
    .eq('merchant_user_id', user.id)
    .maybeSingle();

  if (selErr || !row) {
    return apiJsonError(request, 'notFound', 404);
  }

  const memberUserId = String((row as { member_user_id: string }).member_user_id);

  if (hasRole && role) {
    const { error: upErr } = await supabase
      .from('merchant_team_members')
      .update({ role })
      .eq('id', memberId)
      .eq('merchant_user_id', user.id);

    if (upErr) {
      return apiJsonError(request, 'serverError', 500);
    }

    await supabase.from('merchant_team_audit_log').insert({
      merchant_user_id: user.id,
      actor_user_id: user.id,
      event_type: 'role_changed',
      detail: { member_id: memberId, role },
    });
  }

  if (hasLink) {
    await supabase
      .from('banano_terminal_staff')
      .update({ linked_auth_user_id: null })
      .eq('user_id', user.id)
      .eq('linked_auth_user_id', memberUserId);

    if (linkTerminalStaffId && linkTerminalStaffId.length > 0) {
      const { data: pin, error: pinErr } = await supabase
        .from('banano_terminal_staff')
        .select('id')
        .eq('id', linkTerminalStaffId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (pinErr || !pin) {
        return apiJsonError(request, 'teamLink_pinNotFound', 400);
      }

      const { error: linkErr } = await supabase
        .from('banano_terminal_staff')
        .update({ linked_auth_user_id: memberUserId })
        .eq('id', linkTerminalStaffId)
        .eq('user_id', user.id);

      if (linkErr) {
        console.error('[team/members PATCH link]', linkErr.message);
        return apiJsonError(request, 'serverError', 500);
      }
    }

    await supabase.from('merchant_team_audit_log').insert({
      merchant_user_id: user.id,
      actor_user_id: user.id,
      event_type: 'terminal_pin_linked',
      detail: {
        member_id: memberId,
        terminal_staff_id: linkTerminalStaffId || null,
        cleared: !linkTerminalStaffId,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { memberId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: row, error: selErr } = await supabase
    .from('merchant_team_members')
    .select('id, member_user_id')
    .eq('id', memberId)
    .eq('merchant_user_id', user.id)
    .maybeSingle();

  if (selErr || !row) {
    return apiJsonError(request, 'notFound', 404);
  }

  const memberUserId = String((row as { member_user_id: string }).member_user_id);

  const { error: upErr } = await supabase
    .from('merchant_team_members')
    .update({ status: 'revoked' })
    .eq('id', memberId)
    .eq('merchant_user_id', user.id);

  if (upErr) {
    return apiJsonError(request, 'serverError', 500);
  }

  await supabase.from('merchant_team_audit_log').insert({
    merchant_user_id: user.id,
    actor_user_id: user.id,
    event_type: 'member_revoked',
    detail: { member_id: memberId, member_user_id: memberUserId },
  });

  return NextResponse.json({ ok: true });
}
