import { NextResponse } from 'next/server';
import { buildLegacyRepPayload, WALLET_MEMBER_QUERY_PARAM } from '@/lib/wallet/pass-service';
import { getSiteUrl } from '@/lib/site-url';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET — Métadonnées pour scan Wallet (QR). Le contenu du code-barres pointe ici avec `?m=<memberId>`.
 * Les terminaux peuvent aussi continuer à utiliser la chaîne `REP-…` brute.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const m = url.searchParams.get(WALLET_MEMBER_QUERY_PARAM)?.trim() ?? '';
  if (!m || !UUID_RE.test(m)) {
    return NextResponse.json({ ok: false, error: 'invalid_member' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    memberId: m.toLowerCase(),
    legacyScanPayload: buildLegacyRepPayload(m),
    siteUrl: getSiteUrl(),
  });
}
