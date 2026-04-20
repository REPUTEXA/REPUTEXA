import { getSiteUrl } from '@/lib/site-url';
import { loadAppleWalletCertificatesFromEnv } from '@/lib/banano/apple-wallet-certificates';

export { createWalletPassTranslator } from '@/lib/wallet/wallet-pass-translator';

export const WALLET_MEMBER_RESOLVE_PATH = '/api/banano/wallet/member-resolve';
export const WALLET_MEMBER_QUERY_PARAM = 'm' as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * URL publique pointant vers l’API de résolution membre (QR / code-barres sur le pass).
 * Le terminal ou l’agent Ghost peut envoyer cette chaîne brute comme pour `REP-…`.
 */
export function buildWalletMemberScanUrl(memberId: string): string {
  const origin = getSiteUrl().replace(/\/+$/, '');
  const url = new URL(WALLET_MEMBER_RESOLVE_PATH, origin);
  url.searchParams.set(WALLET_MEMBER_QUERY_PARAM, memberId);
  return url.toString();
}

/** Contenu encodé dans le QR du pass (URL transaction / résolution). */
export function buildWalletBarcodePayload(memberId: string): string {
  return buildWalletMemberScanUrl(memberId);
}

/** Ancien format encore accepté en caisse. */
export function buildLegacyRepPayload(memberId: string): string {
  return `REP-${memberId}`;
}

/**
 * Extrait l’id membre depuis une URL `member-resolve`, ou depuis `REP-<uuid>`.
 */
export function parseMemberIdFromWalletScanPayload(raw: string): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  const rep = trimmed.match(
    /^REP-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
  );
  if (rep?.[1] && UUID_RE.test(rep[1])) return rep[1].toLowerCase();

  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const m =
      u.searchParams.get(WALLET_MEMBER_QUERY_PARAM) ??
      u.searchParams.get('memberId') ??
      u.searchParams.get('id');
    if (m && UUID_RE.test(m)) return m.toLowerCase();
  } catch {
    return null;
  }

  return null;
}

export { loadAppleWalletCertificatesFromEnv };

export type GoogleWalletIssuanceResult =
  | { status: 'ready'; saveUrl: string; objectId: string }
  | { status: 'not_configured'; reason: string }
  | { status: 'error'; message: string };

/**
 * Prépare un lien « Add to Google Wallet » (Loyalty / générique).
 * Placeholder : OAuth2 service account + REST `walletobjects` (à brancher avec les IDs Google Cloud).
 *
 * Variables attendues (documentation) :
 * - GOOGLE_WALLET_ISSUER_ID
 * - GOOGLE_WALLET_SERVICE_ACCOUNT_JSON (JSON complet du compte de service)
 * - GOOGLE_WALLET_LOYALTY_CLASS_ID (optionnel, sinon dérivé du marchand)
 */
export async function prepareGoogleWalletSaveLink(_params: {
  merchantUserId: string;
  memberId: string;
  memberLocale: string | null | undefined;
}): Promise<GoogleWalletIssuanceResult> {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const sa = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON?.trim();
  if (!issuer || !sa) {
    return {
      status: 'not_configured',
      reason: 'google_wallet_env_missing',
    };
  }

  void _params;
  return {
    status: 'not_configured',
    reason: 'google_wallet_rest_not_implemented',
  };
}
