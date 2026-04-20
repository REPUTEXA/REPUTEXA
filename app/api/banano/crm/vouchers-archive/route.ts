import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { expireDueBananoVouchers } from '@/lib/banano/expire-loyalty-vouchers';
import { formatVoucherRewardLine } from '@/lib/banano/format-voucher-reward';
import { sortVouchersForMerchantDisplay } from '@/lib/banano/voucher-display-sort';

const MAX_ROWS = 2000;

function memberLabel(m: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const d = (m.display_name ?? '').trim();
  if (d) return d;
  const a = [m.first_name, m.last_name].map((x) => (x ?? '').trim()).filter(Boolean);
  return a.length ? a.join(' ') : 'Client';
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('banano_loyalty_mode')
    .eq('id', user.id)
    .maybeSingle();
  const loyaltyMode =
    profile && (profile as { banano_loyalty_mode?: string }).banano_loyalty_mode === 'stamps'
      ? 'stamps'
      : 'points';

  await expireDueBananoVouchers(supabase, user.id);

  const { data: rows, error } = await supabase
    .from('banano_loyalty_vouchers')
    .select('*')
    .eq('user_id', user.id)
    .or('voucher_class.is.null,voucher_class.eq.loyalty_threshold')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error('[banano/crm/vouchers-archive]', error.message);
    return apiJsonError(request, 'errors.crm_readFailed', 500);
  }

  const raw = rows ?? [];
  const memberIds = [...new Set(raw.map((r) => r.member_id as string))];
  const memberMap = new Map<
    string,
    { display_name: string | null; phone_e164: string; first_name: string; last_name: string }
  >();

  if (memberIds.length > 0) {
    const { data: memRows, error: memErr } = await supabase
      .from('banano_loyalty_members')
      .select('id, display_name, phone_e164, first_name, last_name')
      .eq('user_id', user.id)
      .in('id', memberIds);
    if (memErr) {
      console.error('[banano/crm/vouchers-archive members]', memErr.message);
    } else {
      for (const m of memRows ?? []) {
        const row = m as {
          id: string;
          display_name: string | null;
          phone_e164: string;
          first_name: string;
          last_name: string;
        };
        memberMap.set(row.id, {
          display_name: row.display_name,
          phone_e164: row.phone_e164,
          first_name: row.first_name,
          last_name: row.last_name,
        });
      }
    }
  }

  const sorted = sortVouchersForMerchantDisplay(raw);

  const vouchers = sorted.map((r) => {
    const mem = memberMap.get(r.member_id as string);
    const rewardLine = formatVoucherRewardLine({
      reward_kind: String(r.reward_kind),
      reward_percent: r.reward_percent,
      reward_euro_cents: r.reward_euro_cents,
      reward_label: String(r.reward_label ?? ''),
    });
    const issuer = (r as { issuer_unit?: string }).issuer_unit;
    const issuerUnit = issuer === 'stamps' ? 'stamps' : issuer === 'staff' ? 'staff' : 'points';
    const vClass = String((r as { voucher_class?: string }).voucher_class ?? 'loyalty_threshold');
    const rem = (r as { remaining_euro_cents?: number | null }).remaining_euro_cents;
    return {
      id: r.id,
      member_id: r.member_id,
      member_name: mem ? memberLabel(mem) : '—',
      member_phone: mem?.phone_e164 ?? '—',
      public_code: r.public_code,
      status: r.status,
      rewardLine,
      threshold_snapshot: r.threshold_snapshot,
      points_balance_after: r.points_balance_after,
      issuer_unit: issuerUnit,
      voucher_class: vClass,
      remaining_euro_cents: rem ?? null,
      created_at: r.created_at,
      expires_at: r.expires_at,
      redeemed_at: r.redeemed_at,
    };
  });

  return NextResponse.json({ loyaltyMode, vouchers });
}
