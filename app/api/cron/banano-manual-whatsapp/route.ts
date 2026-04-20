import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { apiJsonError } from '@/lib/api/api-error-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BATCH = 80;

type OutRow = {
  id: string;
  user_id: string;
  phone_e164: string;
  body: string;
  metadata: Record<string, unknown> | null;
};

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  return !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

async function processBananoManualWhatsAppOutbox(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  cancelled: number;
}> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error('Admin client indisponible');
  }

  const nowIso = new Date().toISOString();

  const { data: rows, error: fetchErr } = await admin
    .from('banano_merchant_manual_whatsapp_outbox')
    .select('id, user_id, phone_e164, body, metadata')
    .eq('status', 'pending')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(BATCH);

  if (fetchErr) {
    console.warn('[cron/banano-manual-whatsapp]', fetchErr.message);
    throw new Error(fetchErr.message);
  }

  const list = (rows ?? []) as OutRow[];
  if (list.length === 0) {
    return { processed: 0, sent: 0, failed: 0, cancelled: 0 };
  }

  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  for (const row of list) {
    const { data: blacklisted } = await admin
      .from('blacklist')
      .select('id')
      .eq('user_id', row.user_id)
      .eq('phone', row.phone_e164)
      .maybeSingle();

    if (blacklisted) {
      await admin
        .from('banano_merchant_manual_whatsapp_outbox')
        .update({
          status: 'cancelled',
          error: 'blacklist',
          metadata: { ...(row.metadata ?? {}), cancelled_at: nowIso },
        })
        .eq('id', row.id);
      cancelled++;
      continue;
    }

    const res = await sendWhatsAppMessage(row.phone_e164, row.body);
    const sentAt = new Date().toISOString();

    if (res.success) {
      await admin
        .from('banano_merchant_manual_whatsapp_outbox')
        .update({
          status: 'sent',
          sent_at: sentAt,
          metadata: {
            ...(row.metadata ?? {}),
            sent_at: sentAt,
            message_id: res.messageId ?? null,
          },
        })
        .eq('id', row.id);
      sent++;
    } else {
      await admin
        .from('banano_merchant_manual_whatsapp_outbox')
        .update({
          status: 'failed',
          error: res.error ?? 'Erreur inconnue',
          metadata: { ...(row.metadata ?? {}), failed_at: sentAt },
        })
        .eq('id', row.id);
      failed++;
    }
  }

  console.info(
    `[cron/banano-manual-whatsapp] processed=${list.length} sent=${sent} failed=${failed} cancelled=${cancelled}`
  );

  return { processed: list.length, sent, failed, cancelled };
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return apiJsonError(request, 'unauthorized', 401);
  }
  try {
    const result = await processBananoManualWhatsAppOutbox();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[cron/banano-manual-whatsapp]', err);
    return apiJsonError(request, 'serverError', 500);
  }
}

export async function GET(request: Request) {
  return POST(request);
}
