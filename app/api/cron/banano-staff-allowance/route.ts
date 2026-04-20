import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateBananoVoucherPublicCode } from '@/lib/banano/loyalty-voucher-code';
import { staffAllowanceMonthKeyParis } from '@/lib/banano/staff-allowance-month-key';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authCron(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  return !!(process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`);
}

function expiresAtIso(validityDays: number | null): string | null {
  if (validityDays == null || validityDays < 1) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + validityDays);
  return d.toISOString();
}

export async function GET(request: Request) {
  const ta = apiAdminT();
  if (!authCron(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const monthKey = staffAllowanceMonthKeyParis();
  let merchants = 0;
  let vouchersCreated = 0;
  let skipped = 0;

  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select(
      'id, banano_staff_allowance_enabled, banano_staff_allowance_monthly_euro_cents, banano_staff_allowance_validity_days'
    )
    .eq('banano_staff_allowance_enabled', true)
    .gt('banano_staff_allowance_monthly_euro_cents', 0);

  if (pErr) {
    console.error('[cron staff-allowance profiles]', pErr.message);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  for (const p of profiles ?? []) {
    const userId = (p as { id: string }).id;
    const cents = Math.floor(
      Number((p as { banano_staff_allowance_monthly_euro_cents?: number }).banano_staff_allowance_monthly_euro_cents) ||
        0
    );
    const vdRaw = (p as { banano_staff_allowance_validity_days?: number | null })
      .banano_staff_allowance_validity_days;
    const validityDays =
      vdRaw == null || !Number.isFinite(Number(vdRaw)) || Number(vdRaw) < 1 ? null : Math.min(3650, Math.floor(Number(vdRaw)));

    if (cents < 1) continue;
    merchants += 1;

    const { data: members, error: mErr } = await admin
      .from('banano_loyalty_members')
      .select('id')
      .eq('user_id', userId)
      .eq('receives_staff_allowance', true);

    if (mErr) {
      console.error('[cron staff-allowance members]', userId, mErr.message);
      continue;
    }

    const expiresAt = expiresAtIso(validityDays);
    const eurosLabel = (cents / 100).toLocaleString('fr-FR', {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });

    for (const mem of members ?? []) {
      const memberId = (mem as { id: string }).id;

      const { data: existing } = await admin
        .from('banano_loyalty_vouchers')
        .select('id')
        .eq('user_id', userId)
        .eq('member_id', memberId)
        .eq('voucher_class', 'staff_allowance')
        .eq('allowance_month_key', monthKey)
        .maybeSingle();

      if (existing) {
        skipped += 1;
        continue;
      }

      let inserted = false;
      for (let attempt = 0; attempt < 10 && !inserted; attempt++) {
        const publicCode = generateBananoVoucherPublicCode();
        const rewardLabel = `Bon collaborateur ${monthKey} — ${eurosLabel} €`.slice(0, 2000);
        const { error: insErr } = await admin.from('banano_loyalty_vouchers').insert({
          user_id: userId,
          member_id: memberId,
          public_code: publicCode,
          status: 'available',
          reward_kind: 'label_only',
          reward_percent: null,
          reward_euro_cents: null,
          reward_label: rewardLabel,
          threshold_snapshot: cents,
          points_balance_after: cents,
          issuer_unit: 'staff',
          voucher_class: 'staff_allowance',
          initial_euro_cents: cents,
          remaining_euro_cents: cents,
          allowance_month_key: monthKey,
          expires_at: expiresAt,
          earn_event_id: null,
        });

        if (!insErr) {
          inserted = true;
          vouchersCreated += 1;
          await admin.from('banano_loyalty_events').insert({
            user_id: userId,
            member_id: memberId,
            event_type: 'staff_allowance_issued',
            delta_points: 0,
            delta_stamps: 0,
            note: `Émission ${publicCode} · ${eurosLabel} € (${monthKey})`,
          });
        } else if ((insErr as { code?: string }).code !== '23505') {
          console.warn('[cron staff-allowance insert]', insErr);
          break;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    monthKey,
    merchantsTouched: merchants,
    vouchersCreated,
    skippedExisting: skipped,
  });
}
