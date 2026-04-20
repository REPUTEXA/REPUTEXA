import { NextResponse } from 'next/server';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { randomBytes } from 'crypto';
import {
  absoluteJoinUrl,
  buildTeamInviteMessage,
  sendTeamInviteWhatsApp,
} from '@/lib/team/send-team-invite-whatsapp';

const INVITE_TTL_HOURS = 72;

export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request);
  if (!rateLimit.ok) {
    return apiJsonError(request, 'auth_rateLimit', 429);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const body = await request.json().catch(() => ({}));
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : '';
  const role = body.role === 'manager' ? 'manager' : 'staff';
  const locale = typeof body.locale === 'string' && body.locale.length === 2 ? body.locale : 'fr';

  if (!displayName || displayName.length > 120) {
    return apiJsonError(request, 'teamInvite_invalidName', 400);
  }

  const parsed = parsePhoneNumberFromString(phoneRaw, 'FR');
  if (!parsed?.isValid()) {
    return apiJsonError(request, 'teamInvite_invalidPhone', 400);
  }
  const phoneE164 = parsed.format('E.164');

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, establishment_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profErr || !profile || (profile as { role?: string }).role === 'merchant_staff') {
    return apiJsonError(request, 'forbidden', 403);
  }

  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { data: inv, error: invErr } = await supabase
    .from('merchant_team_invitations')
    .insert({
      merchant_user_id: user.id,
      token,
      phone_e164: phoneE164,
      invitee_display_name: displayName,
      role,
      expires_at: expiresAt,
    })
    .select('id, token, expires_at')
    .single();

  if (invErr || !inv) {
    console.error('[team/invite]', invErr?.message);
    return apiJsonError(request, 'serverError', 500);
  }

  const establishmentName = String((profile as { establishment_name?: string }).establishment_name ?? '');
  const joinUrl = absoluteJoinUrl(locale, token);
  const waBody = buildTeamInviteMessage({
    inviteeFirstName: displayName.split(/\s+/)[0] ?? displayName,
    establishmentName,
    joinUrl,
  });

  const wa = await sendTeamInviteWhatsApp(phoneE164, waBody);

  await supabase.from('merchant_team_audit_log').insert({
    merchant_user_id: user.id,
    actor_user_id: user.id,
    event_type: 'invite_sent',
    detail: {
      invitation_id: inv.id,
      phone_e164: phoneE164,
      whatsapp_ok: wa.ok,
    },
  });

  return NextResponse.json({
    ok: true,
    invitationId: inv.id,
    expiresAt: inv.expires_at,
    joinUrl,
    whatsappSent: wa.ok,
  });
}
