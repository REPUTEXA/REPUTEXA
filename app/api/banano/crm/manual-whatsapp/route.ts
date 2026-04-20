import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';

export const dynamic = 'force-dynamic';

const MAX_BODY = 4000;
/** Délai minimal avant une date programmée (évite les courses avec le cron). */
const SCHEDULE_MIN_LEAD_MS = 90_000;

type Body = {
  memberId?: string;
  message?: string;
  /** ISO 8601 ; si absent ou passé proche, envoi immédiat. */
  scheduledAt?: string | null;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
  if (!memberId) {
    return apiJsonError(req, 'errors.crm_memberIdRequired', 400);
  }

  const message = String(body.message ?? '').trim();
  if (message.length < 1) {
    return apiJsonError(req, 'errors.messageEmpty', 400);
  }
  if (message.length > MAX_BODY) {
    return apiJsonError(req, 'errors.crm_messageTooLong', 400, { max: MAX_BODY });
  }

  const { data: member, error: memErr } = await supabase
    .from('banano_loyalty_members')
    .select('id, phone_e164, first_name, display_name')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memErr || !member) {
    return apiJsonError(req, 'errors.crm_clientNotFound', 404);
  }

  const phone = String((member as { phone_e164: string }).phone_e164 ?? '').trim();
  if (!phone) {
    return apiJsonError(req, 'errors.crm_phoneMissing', 400);
  }

  const { data: blacklisted } = await supabase
    .from('blacklist')
    .select('id')
    .eq('user_id', user.id)
    .eq('phone', phone)
    .maybeSingle();

  if (blacklisted) {
    return apiJsonError(req, 'errors.crm_phoneBlacklisted', 403);
  }

  const now = Date.now();
  let scheduledAtMs = now;
  if (body.scheduledAt) {
    const t = Date.parse(body.scheduledAt);
    if (!Number.isNaN(t)) scheduledAtMs = t;
  }

  const isScheduled = scheduledAtMs > now + SCHEDULE_MIN_LEAD_MS;

  if (isScheduled) {
    const scheduledIso = new Date(scheduledAtMs).toISOString();
    const { data: inserted, error: insErr } = await supabase
      .from('banano_merchant_manual_whatsapp_outbox')
      .insert({
        user_id: user.id,
        member_id: memberId,
        phone_e164: phone,
        body: message,
        scheduled_at: scheduledIso,
        status: 'pending',
        metadata: {
          first_name: (member as { first_name?: string }).first_name ?? null,
          display_name: (member as { display_name?: string }).display_name ?? null,
        },
      })
      .select('id, scheduled_at')
      .single();

    if (insErr) {
      console.error('[manual-whatsapp insert]', insErr.message);
      return apiJsonError(req, 'errors.crm_scheduleFailed', 500);
    }

    return NextResponse.json({
      ok: true,
      mode: 'scheduled',
      id: inserted?.id,
      scheduledAt: inserted?.scheduled_at ?? scheduledIso,
    });
  }

  const res = await sendWhatsAppMessage(phone, message);
  if (!res.success) {
    if (res.error) {
      console.error('[manual-whatsapp sendWhatsAppMessage]', res.error);
    }
    return apiJsonError(req, 'errors.crm_whatsappSendFailed', 502);
  }

  return NextResponse.json({
    ok: true,
    mode: 'sent',
    messageId: res.messageId,
  });
}
