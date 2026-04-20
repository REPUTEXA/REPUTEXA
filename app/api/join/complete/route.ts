import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiJsonError } from '@/lib/api/api-error-response';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { staffInviteEmailForInvitation } from '@/lib/team/staff-invite-email';

const bodySchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(128),
  locale: z.string().length(2).optional(),
});

export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request);
  if (!rateLimit.ok) {
    return apiJsonError(request, 'auth_rateLimit', 429);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiJsonError(request, 'badRequest', 400);
  }

  const { token, password, locale } = parsed.data;
  const preferredLocale = locale ?? 'fr';

  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(request, 'serverConfiguration', 503);
  }

  const { data: invitation, error: invErr } = await admin
    .from('merchant_team_invitations')
    .select(
      'id, merchant_user_id, phone_e164, invitee_display_name, role, expires_at, consumed_at'
    )
    .eq('token', token)
    .maybeSingle();

  if (invErr || !invitation) {
    return apiJsonError(request, 'joinInvite_notFound', 404);
  }

  if ((invitation as { consumed_at?: string | null }).consumed_at) {
    return apiJsonError(request, 'joinInvite_alreadyUsed', 400);
  }

  const exp = new Date(String((invitation as { expires_at: string }).expires_at));
  if (Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
    return apiJsonError(request, 'joinInvite_expired', 400);
  }

  const invitationId = String((invitation as { id: string }).id);
  const merchantUserId = String((invitation as { merchant_user_id: string }).merchant_user_id);
  const phoneE164 = String((invitation as { phone_e164: string }).phone_e164);
  const inviteeName = String((invitation as { invitee_display_name: string }).invitee_display_name);
  const memberRole = (invitation as { role: string }).role === 'manager' ? 'manager' : 'staff';

  const { data: merchantProfile } = await admin
    .from('profiles')
    .select('establishment_name')
    .eq('id', merchantUserId)
    .maybeSingle();

  const establishmentName =
    merchantProfile && typeof (merchantProfile as { establishment_name?: string }).establishment_name === 'string'
      ? (merchantProfile as { establishment_name: string }).establishment_name
      : '';

  const email = staffInviteEmailForInvitation(invitationId);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      signup_mode: 'merchant_staff',
      full_name: inviteeName,
      phone: phoneE164,
      merchant_establishment_name: establishmentName,
      merchant_user_id: merchantUserId,
      locale: preferredLocale,
      preferred_language: preferredLocale,
    },
  });

  if (createErr || !created.user?.id) {
    console.error('[join/complete] createUser', createErr?.message);
    if (createErr?.message?.toLowerCase().includes('already')) {
      return apiJsonError(request, 'joinInvite_accountExists', 400);
    }
    return apiJsonError(request, 'serverError', 500);
  }

  const memberUserId = created.user.id;

  const { error: memErr } = await admin.from('merchant_team_members').insert({
    merchant_user_id: merchantUserId,
    member_user_id: memberUserId,
    role: memberRole,
    status: 'active',
    invitation_id: invitationId,
  });

  if (memErr) {
    console.error('[join/complete] member insert', memErr.message);
    await admin.auth.admin.deleteUser(memberUserId);
    return apiJsonError(request, 'serverError', 500);
  }

  await admin
    .from('merchant_team_invitations')
    .update({
      consumed_at: new Date().toISOString(),
      consumed_by_user_id: memberUserId,
    })
    .eq('id', invitationId);

  await admin.from('merchant_team_audit_log').insert({
    merchant_user_id: merchantUserId,
    actor_user_id: memberUserId,
    event_type: 'member_joined',
    detail: { invitation_id: invitationId, member_user_id: memberUserId },
  });

  return NextResponse.json({
    ok: true,
    userId: memberUserId,
    email,
  });
}
