import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { expireDueBananoVouchers } from '@/lib/banano/expire-loyalty-vouchers';
import { loyaltyConfigFromProfileRow } from '@/lib/banano/loyalty-profile';
import { BANANO_PROFILE_LOYALTY_COLUMNS } from '@/lib/banano/loyalty-profile-columns';
import { formatVoucherRewardLine } from '@/lib/banano/format-voucher-reward';

const MAX_VOUCHERS = 2000;
const MAX_EVENTS = 800;

function memberLabel(
  m: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  },
  fallback: string
): string {
  const d = (m.display_name ?? '').trim();
  if (d) return d;
  const a = [m.first_name, m.last_name].map((x) => (x ?? '').trim()).filter(Boolean);
  return a.length ? a.join(' ') : fallback;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(request));
  const clientFallback = tm('crmVoucherArchiveMemberFallback');
  const dashPlaceholder = tm('crmStaffAllowanceDashPlaceholder');
  const staffFallback = tm('bananoStaffFallbackLabel');

  await expireDueBananoVouchers(supabase, user.id);

  const { data: profileRow, error: profErr } = await supabase
    .from('profiles')
    .select(BANANO_PROFILE_LOYALTY_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();

  if (profErr || !profileRow) {
    console.error('[staff-allowance-dashboard profile]', profErr?.message);
    return apiJsonError(request, 'errors.crm_readFailed', 500);
  }

  const loyalty = loyaltyConfigFromProfileRow(profileRow as unknown as Record<string, unknown>);
  const settings = loyalty.staffAllowance;

  const { data: eligibleRows, error: elErr } = await supabase
    .from('banano_loyalty_members')
    .select('id, display_name, phone_e164, first_name, last_name, crm_role, receives_staff_allowance')
    .eq('user_id', user.id)
    .eq('receives_staff_allowance', true)
    .order('display_name', { ascending: true });

  if (elErr) {
    console.error('[staff-allowance-dashboard members]', elErr.message);
    return apiJsonError(request, 'errors.crm_readMembersFailed', 500);
  }

  const eligible = eligibleRows ?? [];
  const eligibleIds = eligible.map((m) => m.id as string);

  const voucherSelect =
    'id, member_id, public_code, status, reward_kind, reward_percent, reward_euro_cents, reward_label, threshold_snapshot, points_balance_after, remaining_euro_cents, created_at, expires_at, redeemed_at, allowance_month_key';

  const { data: voucherRows, error: vErr } = await supabase
    .from('banano_loyalty_vouchers')
    .select(voucherSelect)
    .eq('user_id', user.id)
    .eq('voucher_class', 'staff_allowance')
    .order('created_at', { ascending: false })
    .limit(MAX_VOUCHERS);

  if (vErr) {
    console.error('[staff-allowance-dashboard vouchers]', vErr.message);
    return apiJsonError(request, 'errors.crm_readVouchersFailed', 500);
  }

  const vouchersRaw = voucherRows ?? [];
  const voucherMemberIds = [...new Set(vouchersRaw.map((r) => r.member_id as string))];

  const byMemberAvail = new Map<
    string,
    {
      id: string;
      public_code: string;
      remaining_euro_cents: number;
      status: string;
      created_at: string;
      expires_at: string | null;
      rewardLine: string;
    }[]
  >();

  for (const r of vouchersRaw) {
    const mid = r.member_id as string;
    const rem = Math.floor(Number((r as { remaining_euro_cents?: number | null }).remaining_euro_cents ?? 0));
    const st = String(r.status);
    if (st === 'available' && rem > 0) {
      const rewardLine = formatVoucherRewardLine({
        reward_kind: String(r.reward_kind),
        reward_percent: r.reward_percent,
        reward_euro_cents: r.reward_euro_cents,
        reward_label: String(r.reward_label ?? ''),
      });
      const cur = byMemberAvail.get(mid) ?? [];
      cur.push({
        id: r.id as string,
        public_code: String(r.public_code),
        remaining_euro_cents: rem,
        status: st,
        created_at: String(r.created_at),
        expires_at: r.expires_at != null ? String(r.expires_at) : null,
        rewardLine,
      });
      byMemberAvail.set(mid, cur);
    }
  }

  const employees = eligible.map((m) => {
    const row = m as {
      id: string;
      display_name: string | null;
      phone_e164: string;
      first_name: string | null;
      last_name: string | null;
      crm_role: string | null;
      receives_staff_allowance: boolean;
    };
    const avail = (byMemberAvail.get(row.id) ?? []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const totalRemainingCents = avail.reduce((s, v) => s + v.remaining_euro_cents, 0);
    return {
      id: row.id,
      display_name: memberLabel(row, clientFallback),
      phone_e164: row.phone_e164,
      crm_role: row.crm_role,
      receives_staff_allowance: row.receives_staff_allowance,
      active_vouchers: avail,
      total_remaining_euro_cents: totalRemainingCents,
    };
  });

  const { data: eventRows, error: evErr } = await supabase
    .from('banano_loyalty_events')
    .select('id, member_id, event_type, note, amount_cents, created_at, staff_id')
    .eq('user_id', user.id)
    .in('event_type', [
      'staff_allowance_issued',
      'staff_allowance_debit',
      'staff_allowance_merchant_adjust',
    ])
    .order('created_at', { ascending: false })
    .limit(MAX_EVENTS);

  if (evErr) {
    console.error('[staff-allowance-dashboard events]', evErr.message);
    return apiJsonError(request, 'errors.crm_readMovementsFailed', 500);
  }

  const evRaw = eventRows ?? [];
  const evMemberIds = [...new Set(evRaw.map((e) => e.member_id as string))];
  const staffIds = [
    ...new Set(
      evRaw
        .map((e) => (e as { staff_id?: string | null }).staff_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];
  const staffNameById = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: stRows, error: stErr } = await supabase
      .from('banano_terminal_staff')
      .select('id, display_name')
      .eq('user_id', user.id)
      .in('id', staffIds);
    if (!stErr) {
      for (const s of stRows ?? []) {
        const row = s as { id: string; display_name: string };
        staffNameById.set(row.id, (row.display_name ?? '').trim() || staffFallback);
      }
    }
  }

  const memMap = new Map<string, string>();
  const needNames = [...new Set([...eligibleIds, ...evMemberIds, ...voucherMemberIds])];
  if (needNames.length > 0) {
    const { data: memBits } = await supabase
      .from('banano_loyalty_members')
      .select('id, display_name, first_name, last_name')
      .eq('user_id', user.id)
      .in('id', needNames);
    for (const mb of memBits ?? []) {
      const b = mb as {
        id: string;
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
      };
      memMap.set(b.id, memberLabel(b, clientFallback));
    }
  }

  const events = evRaw.map((e) => {
    const er = e as {
      id: string;
      member_id: string;
      event_type: string;
      note: string | null;
      amount_cents: number | null;
      created_at: string;
      staff_id: string | null;
    };
    return {
      id: er.id,
      member_id: er.member_id,
      member_name: memMap.get(er.member_id) ?? dashPlaceholder,
      event_type: er.event_type,
      note: er.note,
      amount_cents: er.amount_cents,
      created_at: er.created_at,
      staff_id: er.staff_id,
      cashier_name:
        er.staff_id && staffNameById.has(er.staff_id) ? staffNameById.get(er.staff_id) ?? null : null,
    };
  });

  const vouchers = vouchersRaw.map((r) => {
    const rem = (r as { remaining_euro_cents?: number | null }).remaining_euro_cents;
    const memId = r.member_id as string;
    return {
      id: r.id as string,
      member_id: memId,
      member_name: memMap.get(memId) ?? dashPlaceholder,
      public_code: String(r.public_code),
      status: String(r.status),
      rewardLine: formatVoucherRewardLine({
        reward_kind: String(r.reward_kind),
        reward_percent: r.reward_percent,
        reward_euro_cents: r.reward_euro_cents,
        reward_label: String(r.reward_label ?? ''),
      }),
      issued_euro_cents: Math.floor(Number(r.threshold_snapshot) || 0),
      remaining_euro_cents: rem != null ? Math.floor(Number(rem)) : null,
      points_balance_after: Math.floor(Number(r.points_balance_after) || 0),
      allowance_month_key: (r as { allowance_month_key?: string | null }).allowance_month_key ?? null,
      created_at: String(r.created_at),
      expires_at: r.expires_at != null ? String(r.expires_at) : null,
      redeemed_at: r.redeemed_at != null ? String(r.redeemed_at) : null,
    };
  });

  const totalRemainingAllCents = employees.reduce((s, e) => s + e.total_remaining_euro_cents, 0);

  return NextResponse.json({
    meta: {
      generatedAt: new Date().toISOString(),
      voucherCount: vouchers.length,
      eligibleCount: employees.length,
      totalRemainingEuroCents: totalRemainingAllCents,
      movementCount: events.length,
    },
    settings,
    employees,
    vouchers,
    events,
  });
}
