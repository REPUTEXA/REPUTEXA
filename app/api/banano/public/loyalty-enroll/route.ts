import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { sha256Hex } from '@/lib/banano/ghost-agent-token';
import { signWalletLinkPayload } from '@/lib/banano/wallet-link-token';
import { isAppleWalletSigningConfigured } from '@/lib/banano/apple-wallet-certificates';
import { getSiteUrl } from '@/lib/site-url';

const bodySchema = z.object({
  slug: z.string().trim().min(3).max(120),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(40),
  birthDate: z.string().trim().max(32).optional(),
  deviceFingerprint: z.string().trim().min(16).max(512).optional(),
  turnstileToken: z.string().optional(),
  defaultCountry: z.string().length(2).optional(),
});

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip')?.trim();
  return real || null;
}

/**
 * POST — Enrôlement public fidélité (QR magasin) : crée `banano_loyalty_members` + lien Wallet signé.
 */
export async function POST(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));

  const secret = process.env.BANANO_WALLET_LINK_SECRET?.trim();
  if (!secret || secret.length < 24) {
    return NextResponse.json({ error: tm('bananoWalletLinkSecretMissing') }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: tm('serviceUnavailable') }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tm('publicLoyaltyEnrollInvalidPayload'), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { slug, firstName, lastName, phone, birthDate, deviceFingerprint, turnstileToken, defaultCountry } =
    parsed.data;

  const tsOk = await verifyTurnstileToken(turnstileToken ?? '');
  if (!tsOk) {
    return NextResponse.json({ error: tm('turnstileVerificationFailed') }, { status: 400 });
  }

  const cc = ((defaultCountry ?? 'FR').toUpperCase().slice(0, 2) || 'FR') as CountryCode;
  const pn = parsePhoneNumberFromString(phone, cc);
  if (!pn?.isValid()) {
    return NextResponse.json({ error: tm('publicLoyaltyEnrollPhoneInvalid') }, { status: 400 });
  }
  const phoneE164 = pn.number;

  const { data: merchant, error: mErr } = await admin
    .from('profiles')
    .select('id, establishment_name')
    .eq('banano_terminal_public_slug', slug)
    .maybeSingle();

  if (mErr || !merchant?.id) {
    return NextResponse.json({ error: tm('establishmentNotFound') }, { status: 404 });
  }

  const merchantId = merchant.id as string;

  const { data: existingPhone } = await admin
    .from('banano_loyalty_members')
    .select('id')
    .eq('user_id', merchantId)
    .eq('phone_e164', phoneE164)
    .maybeSingle();

  if (existingPhone?.id) {
    return NextResponse.json(
      { error: tm('publicLoyaltyEnrollPhoneDuplicate'), code: 'duplicate_phone' },
      { status: 409 }
    );
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const combinedLen = fullName.replace(/\s+/g, '').length;
  if (combinedLen >= 4) {
    const { data: fuzzyRows, error: fuzzyErr } = await admin.rpc('banano_enrollment_fuzzy_conflict', {
      p_merchant: merchantId,
      p_first: firstName,
      p_last: lastName,
      p_max_distance: 2,
    });

    if (fuzzyErr) {
      console.warn('[loyalty-enroll fuzzy]', fuzzyErr.message);
    } else if (Array.isArray(fuzzyRows) && fuzzyRows.length > 0) {
      return NextResponse.json(
        {
          error: tm('publicLoyaltyEnrollSimilarProfile'),
          code: 'similar_profile',
        },
        { status: 409 }
      );
    }
  }

  let fpHash: string | null = null;
  if (deviceFingerprint) {
    fpHash = sha256Hex(deviceFingerprint);
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
  }

  const ip = clientIp(req);
  let birth: string | null = null;
  if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    birth = birthDate;
  }

  const insertRow: Record<string, unknown> = {
    user_id: merchantId,
    phone_e164: phoneE164,
    first_name: firstName,
    last_name: lastName,
    display_name: fullName,
    enrollment_ip: ip,
    enrollment_fingerprint_sha256: fpHash,
  };
  if (birth) insertRow.birth_date = birth;

  const { data: inserted, error: insErr } = await admin
    .from('banano_loyalty_members')
    .insert(insertRow)
    .select('id, points_balance, stamps_balance')
    .maybeSingle();

  if (insErr || !inserted?.id) {
    if (insErr?.code === '23505') {
      return NextResponse.json(
        { error: tm('publicLoyaltyEnrollPhoneDuplicate'), code: 'duplicate_phone' },
        { status: 409 }
      );
    }
    console.error('[loyalty-enroll]', insErr?.message);
    return NextResponse.json({ error: tm('publicLoyaltyEnrollProfileCreateFailed') }, { status: 500 });
  }

  const memberId = inserted.id as string;

  if (fpHash) {
    const { error: lockErr } = await admin.from('banano_wallet_device_locks').insert({
      user_id: merchantId,
      device_fingerprint_sha256: fpHash,
      member_id: memberId,
      platform: 'unknown',
    });
    if (lockErr) {
      console.warn('[loyalty-enroll device_lock]', lockErr.message);
    }
  }

  void admin.from('banano_ghost_audit_events').insert({
    user_id: merchantId,
    member_id: memberId,
    source: 'public_enroll',
    action: 'enroll',
    payload: { slug },
  });

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const token = signWalletLinkPayload({ m: memberId, u: merchantId, exp }, secret);
  const base = getSiteUrl().replace(/\/+$/, '');
  const smartWalletUrl = `${base}/api/banano/wallet/smart-add?t=${encodeURIComponent(token)}`;

  return NextResponse.json({
    ok: true,
    memberId,
    establishmentName: (merchant as { establishment_name?: string }).establishment_name ?? null,
    balances: {
      points: (inserted as { points_balance?: number }).points_balance ?? 0,
      stamps: (inserted as { stamps_balance?: number }).stamps_balance ?? 0,
    },
    smartWalletUrl,
    walletQrPayload: `REP-${memberId}`,
    appleWalletPassReady: isAppleWalletSigningConfigured(),
  });
}
