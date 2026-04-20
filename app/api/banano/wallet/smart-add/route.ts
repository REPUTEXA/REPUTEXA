import { NextResponse } from 'next/server';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWalletLinkToken } from '@/lib/banano/wallet-link-token';
import { buildBananoAppleWalletPass } from '@/lib/banano/apple-wallet-pass';
import { isAppleWalletSigningConfigured } from '@/lib/banano/apple-wallet-certificates';
import { buildLegacyRepPayload, buildWalletBarcodePayload } from '@/lib/wallet/pass-service';

function safePassFileBase(m: { display_name?: string | null; first_name?: string | null; last_name?: string | null }) {
  const raw = [m.first_name, m.last_name].map((x) => (x ?? '').trim()).filter(Boolean).join('-');
  const d = (m.display_name ?? '').trim().replace(/\s+/g, '-');
  const base = (raw || d || 'banano').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 48);
  return base || 'banano';
}

/**
 * GET — Smart link Wallet : vérifie le jeton signé, renvoie JSON ou le fichier .pkpass (iPhone / ?fmt=pkpass).
 */
export async function GET(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));

  const secret = process.env.BANANO_WALLET_LINK_SECRET?.trim();
  if (!secret || secret.length < 24) {
    return NextResponse.json({ error: tm('bananoWalletLinkSecretMissing') }, { status: 503 });
  }

  const url = new URL(req.url);
  const rawT = url.searchParams.get('t') ?? '';
  const fmt = url.searchParams.get('fmt') ?? '';

  const payload = verifyWalletLinkToken(rawT, secret);
  if (!payload) {
    return NextResponse.json({ error: tm('bananoWalletLinkInvalidOrExpired') }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: tm('serviceUnavailable') }, { status: 503 });
  }

  const { data: member } = await admin
    .from('banano_loyalty_members')
    .select(
      'id, first_name, last_name, display_name, phone_e164, points_balance, stamps_balance, user_id'
    )
    .eq('id', payload.m)
    .eq('user_id', payload.u)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: tm('bananoWalletMemberNotFound') }, { status: 404 });
  }

  const { data: prof } = await admin
    .from('profiles')
    .select('establishment_name, banano_wallet_geo_points')
    .eq('id', payload.u)
    .maybeSingle();

  const ua = (req.headers.get('user-agent') ?? '').toLowerCase();
  const isApple = ua.includes('iphone') || ua.includes('ipad') || ua.includes('mac os');
  const isAndroid = ua.includes('android');
  const passSigningReady = isAppleWalletSigningConfigured();

  if (fmt === 'json') {
    return NextResponse.json({
      ok: true,
      platformHint: isApple ? 'apple' : isAndroid ? 'android' : 'unknown',
      member: {
        id: member.id,
        displayName: (member as { display_name?: string }).display_name,
        points: (member as { points_balance?: number }).points_balance,
        stamps: (member as { stamps_balance?: number }).stamps_balance,
      },
      establishment: (prof as { establishment_name?: string } | null)?.establishment_name ?? null,
      geoPoints: (prof as { banano_wallet_geo_points?: unknown } | null)?.banano_wallet_geo_points ?? [],
      appleWallet: passSigningReady
        ? {
            status: 'ready',
            detail: tm('bananoWalletAppleReadyDetail'),
          }
        : {
            status: 'pending_certificates',
            detail: tm('bananoWalletApplePendingDetail'),
          },
      googleWallet: {
        status: 'pending_integration',
        detail: tm('bananoWalletGooglePendingDetail'),
      },
      scanPayloadForRegister: buildLegacyRepPayload(String(member.id)),
      walletMemberScanUrl: buildWalletBarcodePayload(String(member.id)),
      legacyRepPayload: buildLegacyRepPayload(String(member.id)),
    });
  }

  if (fmt === 'pkpass' && !passSigningReady) {
    return NextResponse.json({ error: tm('bananoWalletApplePassCertsNotConfigured') }, { status: 503 });
  }

  const wantPkpass = fmt === 'pkpass' || (isApple && passSigningReady);

  if (wantPkpass && passSigningReady) {
    try {
      const buf = await buildBananoAppleWalletPass(admin, payload.u, payload.m);
      const fname = `banano-${safePassFileBase(member as Record<string, string | null | undefined>)}.pkpass`;
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `attachment; filename="${fname}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (e) {
      console.error('[smart-add pkpass]', e);
      return NextResponse.json(
        {
          error: tm('bananoWalletApplePassGenerationFailed'),
          detail: e instanceof Error ? e.message : String(e),
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      passSigningReady && !isApple
        ? tm('bananoWalletHintPkpassJsonAndroid')
        : tm('bananoWalletHintJsonOnly'),
    platformHint: isApple ? 'apple' : isAndroid ? 'android' : 'unknown',
    scanPayloadForRegister: buildLegacyRepPayload(String(member.id)),
    walletMemberScanUrl: buildWalletBarcodePayload(String(member.id)),
    legacyRepPayload: buildLegacyRepPayload(String(member.id)),
    appleWalletConfigured: passSigningReady,
  });
}
