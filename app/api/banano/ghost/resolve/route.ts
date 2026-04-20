import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { resolveGhostAgentMerchantId } from '@/lib/banano/ghost-auth';
import { resolveGhostScanInput } from '@/lib/banano/ghost-resolve-scan';
import { expireDueBananoVouchers } from '@/lib/banano/expire-loyalty-vouchers';
import { BANANO_PROFILE_LOYALTY_COLUMNS } from '@/lib/banano/loyalty-profile-columns';

type Body = { raw?: string };

/**
 * POST — Résout un scan douchette (Bearer = jeton Agent Ghost).
 */
export async function POST(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(req, 'serviceUnavailable', 503);
  }

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const merchantId = await resolveGhostAgentMerchantId(admin, bearer);
  if (!merchantId) {
    return NextResponse.json({ error: tm('ghostAgentTokenInvalid') }, { status: 401 });
  }

  await expireDueBananoVouchers(admin, merchantId);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const raw = typeof body.raw === 'string' ? body.raw : '';
  const resolved = resolveGhostScanInput(raw);

  if (resolved.kind === 'unknown') {
    void admin.from('banano_ghost_audit_events').insert({
      user_id: merchantId,
      member_id: null,
      action: 'scan_resolve',
      payload: { raw, resolved: 'unknown' },
    });
    return NextResponse.json({ ok: true, resolved: 'unknown', raw });
  }

  if (resolved.kind === 'member_card') {
    const { data: member } = await admin
      .from('banano_loyalty_members')
      .select(
        'id, first_name, last_name, display_name, phone_e164, points_balance, stamps_balance, crm_role, receives_staff_allowance'
      )
      .eq('id', resolved.memberId)
      .eq('user_id', merchantId)
      .maybeSingle();

    void admin.from('banano_ghost_audit_events').insert({
      user_id: merchantId,
      member_id: resolved.memberId,
      action: 'scan_resolve',
      payload: { raw, resolved: 'member_card', found: Boolean(member) },
    });

    if (!member) {
      return NextResponse.json(
        { ok: false, error: tm('ghostUnknownCard'), raw },
        { status: 404 }
      );
    }

    const mRow = member as {
      receives_staff_allowance?: boolean;
      crm_role?: string | null;
    };
    const receives = Boolean(mRow.receives_staff_allowance);
    const role = String(mRow.crm_role ?? '').trim();
    const { data: profileRow } = await admin
      .from('profiles')
      .select(BANANO_PROFILE_LOYALTY_COLUMNS)
      .eq('id', merchantId)
      .maybeSingle();
    const prof = profileRow as {
      banano_staff_allowance_enabled?: boolean;
      banano_staff_allowance_monthly_euro_cents?: number | null;
    } | null;
    const allowanceEnabled = Boolean(prof?.banano_staff_allowance_enabled);
    const monthlyBudget = Math.max(
      0,
      Math.floor(Number(prof?.banano_staff_allowance_monthly_euro_cents ?? 0))
    );
    const staffEligible = allowanceEnabled && receives && role === 'staff';

    let remainingStaffCents = 0;
    if (staffEligible) {
      const { data: staffVouchers } = await admin
        .from('banano_loyalty_vouchers')
        .select('remaining_euro_cents, status, expires_at')
        .eq('user_id', merchantId)
        .eq('member_id', resolved.memberId)
        .eq('voucher_class', 'staff_allowance')
        .eq('status', 'available');

      const nowMs = Date.now();
      for (const r of staffVouchers ?? []) {
        const row = r as { remaining_euro_cents?: number | null; expires_at?: string | null };
        const exp = row.expires_at;
        if (typeof exp === 'string' && exp && new Date(exp).getTime() < nowMs) continue;
        remainingStaffCents += Math.floor(Number(row.remaining_euro_cents ?? 0));
      }
    }

    const staff_allowance = {
      eligible: staffEligible,
      monthly_budget_euro_cents: allowanceEnabled ? monthlyBudget : null,
      remaining_euro_cents: staffEligible ? remainingStaffCents : 0,
    };

    return NextResponse.json({
      ok: true,
      resolved: 'member_card',
      raw,
      member,
      staff_allowance,
    });
  }

  const { data: voucher } = await admin
    .from('banano_loyalty_vouchers')
    .select(
      'id, public_code, status, reward_kind, reward_percent, reward_euro_cents, reward_label, member_id, expires_at'
    )
    .eq('user_id', merchantId)
    .eq('public_code', resolved.publicCode)
    .maybeSingle();

  void admin.from('banano_ghost_audit_events').insert({
    user_id: merchantId,
    member_id: (voucher as { member_id?: string } | null)?.member_id ?? null,
    action: 'scan_resolve',
    payload: { raw, resolved: 'voucher', found: Boolean(voucher) },
  });

  if (!voucher) {
    return NextResponse.json({ ok: false, error: tm('staffVoucherNotFound'), raw }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    resolved: 'voucher',
    raw,
    voucher,
  });
}
