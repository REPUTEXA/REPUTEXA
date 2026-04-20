import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { sha256Hex } from '@/lib/banano/ghost-agent-token';
import { signWalletLinkPayload } from '@/lib/banano/wallet-link-token';
import { getSiteUrl } from '@/lib/site-url';
import { isAppleWalletSigningConfigured } from '@/lib/banano/apple-wallet-certificates';
import { BANANO_PROFILE_LOYALTY_COLUMNS } from '@/lib/banano/loyalty-profile-columns';
import { loyaltyConfigFromProfileRow } from '@/lib/banano/loyalty-profile';
import { ensureSignupWelcomeVoucher } from '@/lib/banano/signup-welcome-voucher';

const bodySchema = z.object({
  merchantId: z.string().uuid(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deviceFingerprint: z.string().trim().min(16).max(512),
});

function splitOAuthNames(meta: Record<string, unknown>): { first: string; last: string } {
  const given =
    typeof meta.given_name === 'string'
      ? meta.given_name.trim()
      : typeof meta.first_name === 'string'
        ? meta.first_name.trim()
        : '';
  const family =
    typeof meta.family_name === 'string'
      ? meta.family_name.trim()
      : typeof meta.last_name === 'string'
        ? meta.last_name.trim()
        : '';
  if (given || family) {
    return { first: given, last: family };
  }
  const full =
    typeof meta.full_name === 'string'
      ? meta.full_name.trim()
      : typeof meta.name === 'string'
        ? meta.name.trim()
        : '';
  if (!full) return { first: '', last: '' };
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

/**
 * POST — Finalise l'onboarding Wallet OAuth : profil, anti-fraude, membre fidélité, lien smart-add.
 */
export async function POST(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const secret = process.env.BANANO_WALLET_LINK_SECRET?.trim();
  if (!secret || secret.length < 24) {
    return NextResponse.json({ error: tm('bananoWalletLinkSecretMissing') }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: tm('unauthorized') }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: tm('publicLoyaltyEnrollInvalidPayload') }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tm('publicLoyaltyEnrollInvalidPayload'), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { merchantId, birthDate, deviceFingerprint } = parsed.data;
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: tm('serviceUnavailable') }, { status: 503 });
  }

  const { data: merchant, error: mErr } = await admin
    .from('profiles')
    .select('id, establishment_name')
    .eq('id', merchantId)
    .maybeSingle();

  if (mErr || !merchant?.id) {
    return NextResponse.json({ error: tm('establishmentNotFound') }, { status: 404 });
  }

  const fpHash = sha256Hex(deviceFingerprint);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: fpRows } = await admin
    .from('wallet_device_signup_events')
    .select('auth_user_id')
    .eq('device_fingerprint_sha256', fpHash)
    .gte('created_at', since);

  const seen = new Set(
    (fpRows ?? []).map((r) => (r as { auth_user_id?: string }).auth_user_id).filter(Boolean) as string[]
  );
  const others = [...seen].filter((id) => id !== user.id);
  const isNewAccountForDevice = !seen.has(user.id);
  if (isNewAccountForDevice && others.length >= 2) {
    await admin.from('wallet_security_alerts').insert({
      kind: 'device_fingerprint_multi_account',
      device_fingerprint_sha256: fpHash,
      auth_user_id: user.id,
      detail: { alert: 'suspected_fraud', otherAccounts24h: others.length },
    });
    return NextResponse.json(
      {
        error: tm('walletJoinDeviceFraudBlocked'),
        code: 'device_fingerprint_fraud',
      },
      { status: 403 }
    );
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const oauthNames = splitOAuthNames(meta);

  const { data: profBefore } = await admin
    .from('profiles')
    .select('wallet_given_name, wallet_family_name, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const pb = profBefore as {
    wallet_given_name?: string | null;
    wallet_family_name?: string | null;
    full_name?: string | null;
  } | null;

  let firstName = (oauthNames.first || (pb?.wallet_given_name ?? '').trim()).trim();
  let lastName = (oauthNames.last || (pb?.wallet_family_name ?? '').trim()).trim();
  if (!firstName || !lastName) {
    const split = splitFullName((pb?.full_name ?? '').trim());
    if (!firstName) firstName = split.first;
    if (!lastName) lastName = split.last;
  }

  if (!firstName.trim() || !lastName.trim()) {
    return NextResponse.json(
      { error: tm('walletJoinNamesMissing'), code: 'names_missing' },
      { status: 400 }
    );
  }

  const patch: Record<string, string | null> = {
    wallet_given_name: firstName,
    wallet_family_name: lastName,
    wallet_birth_date: birthDate,
    device_fingerprint_sha256: fpHash,
  };

  const { error: profErr } = await admin.from('profiles').update(patch).eq('id', user.id);

  if (profErr) {
    const msg = profErr.message ?? '';
    if (msg.includes('WALLET_PROFILE_IDENTITY_DUPLICATE') || profErr.code === 'P0001') {
      return NextResponse.json(
        {
          error: tm('walletJoinIdentityDuplicate'),
          code: 'identity_duplicate',
        },
        { status: 409 }
      );
    }
    console.error('[wallet oauth-complete profile]', profErr);
    return NextResponse.json({ error: tm('publicLoyaltyEnrollProfileCreateFailed') }, { status: 500 });
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const { data: existingMember } = await admin
    .from('banano_loyalty_members')
    .select('id, points_balance, stamps_balance')
    .eq('user_id', merchantId)
    .eq('auth_user_id', user.id)
    .maybeSingle();

  let memberId: string;
  let points = 0;
  let stamps = 0;
  let createdNewLoyaltyMember = false;

  if (existingMember?.id) {
    memberId = existingMember.id as string;
    points = (existingMember as { points_balance?: number }).points_balance ?? 0;
    stamps = (existingMember as { stamps_balance?: number }).stamps_balance ?? 0;
  } else {
    const combinedLen = fullName.replace(/\s+/g, '').length;
    if (combinedLen >= 4) {
      const { data: fuzzyRows, error: fuzzyErr } = await admin.rpc('banano_enrollment_fuzzy_conflict', {
        p_merchant: merchantId,
        p_first: firstName,
        p_last: lastName,
        p_max_distance: 2,
      });
      if (!fuzzyErr && Array.isArray(fuzzyRows) && fuzzyRows.length > 0) {
        return NextResponse.json(
          {
            error: tm('publicLoyaltyEnrollSimilarProfile'),
            code: 'similar_profile',
          },
          { status: 409 }
        );
      }
    }

    const { data: lock } = await admin
      .from('banano_wallet_device_locks')
      .select('member_id')
      .eq('user_id', merchantId)
      .eq('device_fingerprint_sha256', fpHash)
      .maybeSingle();

    if (lock?.member_id) {
      return NextResponse.json(
        {
          error: tm('publicLoyaltyEnrollDeviceLocked'),
          code: 'device_locked',
        },
        { status: 409 }
      );
    }

    const insertRow: Record<string, unknown> = {
      user_id: merchantId,
      auth_user_id: user.id,
      phone_e164: null,
      first_name: firstName,
      last_name: lastName,
      display_name: fullName,
      birth_date: birthDate,
      enrollment_fingerprint_sha256: fpHash,
    };

    const { data: inserted, error: insErr } = await admin
      .from('banano_loyalty_members')
      .insert(insertRow)
      .select('id, points_balance, stamps_balance')
      .maybeSingle();

    if (insErr || !inserted?.id) {
      if (insErr?.code === '23505') {
        return NextResponse.json(
          {
            error: tm('walletJoinDuplicateMember'),
            code: 'duplicate_member',
          },
          { status: 409 }
        );
      }
      console.error('[wallet oauth-complete member]', insErr?.message);
      return NextResponse.json({ error: tm('publicLoyaltyEnrollProfileCreateFailed') }, { status: 500 });
    }

    memberId = inserted.id as string;
    points = (inserted as { points_balance?: number }).points_balance ?? 0;
    stamps = (inserted as { stamps_balance?: number }).stamps_balance ?? 0;
    createdNewLoyaltyMember = true;

    const { error: lockErr } = await admin.from('banano_wallet_device_locks').insert({
      user_id: merchantId,
      device_fingerprint_sha256: fpHash,
      member_id: memberId,
      platform: 'unknown',
    });
    if (lockErr) {
      console.warn('[wallet oauth-complete device_lock]', lockErr.message);
    }
  }

  await admin.from('wallet_device_signup_events').upsert(
    {
      device_fingerprint_sha256: fpHash,
      auth_user_id: user.id,
    },
    { onConflict: 'device_fingerprint_sha256,auth_user_id' }
  );

  void admin.from('banano_ghost_audit_events').insert({
    user_id: merchantId,
    member_id: memberId,
    source: 'wallet_bind',
    action: 'enroll',
    payload: { oauth_wallet: true },
  });

  if (createdNewLoyaltyMember) {
    try {
      const { data: loyaltyProf } = await admin
        .from('profiles')
        .select(`${BANANO_PROFILE_LOYALTY_COLUMNS}, language`)
        .eq('id', merchantId)
        .maybeSingle();
      if (loyaltyProf) {
        const loyalty = loyaltyConfigFromProfileRow(loyaltyProf as unknown as Record<string, unknown>);
        const loc = String((loyaltyProf as { language?: string }).language ?? '').trim();
        const welcomeRes = await ensureSignupWelcomeVoucher({
          supabase: admin,
          merchantUserId: merchantId,
          memberId,
          cfg: loyalty.signupWelcome,
          pointsBalance: points,
          stampsBalance: stamps,
          loyaltyMode: loyalty.mode,
          merchantLocale: loc || null,
        });
        if ('error' in welcomeRes && welcomeRes.error) {
          console.warn('[wallet oauth-complete signup_welcome]', welcomeRes.error);
        }
      }
    } catch (e) {
      console.warn('[wallet oauth-complete signup_welcome]', e);
    }
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const token = signWalletLinkPayload({ m: memberId, u: merchantId, exp }, secret);
  const base = getSiteUrl().replace(/\/+$/, '');
  const smartWalletUrl = `${base}/api/banano/wallet/smart-add?t=${encodeURIComponent(token)}`;

  return NextResponse.json({
    ok: true,
    memberId,
    establishmentName: (merchant as { establishment_name?: string }).establishment_name ?? null,
    balances: { points, stamps },
    smartWalletUrl,
    walletQrPayload: `REP-${memberId}`,
    appleWalletPassReady: isAppleWalletSigningConfigured(),
  });
}

function splitFullName(full: string): { first: string; last: string } {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}
