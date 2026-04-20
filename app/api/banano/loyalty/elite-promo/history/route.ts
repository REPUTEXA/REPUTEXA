import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export type ElitePromoHistoryRow = {
  id: string;
  created_at: string;
  month_key: string;
  offer_text: string;
  full_message: string | null;
  audio_storage_path: string | null;
  whatsapp_message_id: string | null;
  member_id: string;
  display_name: string;
  phone_e164: string;
};

/**
 * GET — Archive des promos Champions envoyées (traçabilité).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const url = new URL(req.url);
  const monthFilter = (url.searchParams.get('monthKey') ?? '').trim();
  const limit = Math.min(LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') ?? '80', 10) || 80));

  let q = supabase
    .from('banano_loyalty_elite_promo_log')
    .select('id, created_at, month_key, offer_text, full_message, audio_storage_path, whatsapp_message_id, member_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(monthFilter)) {
    q = q.eq('month_key', monthFilter);
  }

  const { data: logs, error: logErr } = await q;

  if (logErr) {
    console.error('[elite-promo history]', logErr.message);
    return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  }

  const rows = logs ?? [];
  const memberIds = [...new Set(rows.map((r) => (r as { member_id: string }).member_id))];

  let memberMap = new Map<string, { display_name: string; phone_e164: string }>();
  if (memberIds.length > 0) {
    const { data: mems, error: mErr } = await supabase
      .from('banano_loyalty_members')
      .select('id, display_name, phone_e164')
      .eq('user_id', user.id)
      .in('id', memberIds);

    if (!mErr && mems) {
      memberMap = new Map(
        mems.map((m) => [
          (m as { id: string }).id,
          {
            display_name: String((m as { display_name?: string }).display_name ?? '').trim() || '—',
            phone_e164: String((m as { phone_e164?: string }).phone_e164 ?? '').trim(),
          },
        ])
      );
    }
  }

  const out: ElitePromoHistoryRow[] = rows.map((raw) => {
    const r = raw as {
      id: string;
      created_at: string;
      month_key: string;
      offer_text: string;
      full_message: string | null;
      audio_storage_path: string | null;
      whatsapp_message_id: string | null;
      member_id: string;
    };
    const m = memberMap.get(r.member_id);
    return {
      id: r.id,
      created_at: r.created_at,
      month_key: r.month_key,
      offer_text: r.offer_text,
      full_message: r.full_message,
      audio_storage_path: r.audio_storage_path,
      whatsapp_message_id: r.whatsapp_message_id,
      member_id: r.member_id,
      display_name: m?.display_name ?? '—',
      phone_e164: m?.phone_e164 ?? '',
    };
  });

  return NextResponse.json({ ok: true, rows: out });
}
