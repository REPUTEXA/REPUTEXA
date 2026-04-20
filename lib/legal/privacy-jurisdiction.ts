import type { NextRequest } from 'next/server';

export type PrivacyJurisdiction = 'eu_gdpr' | 'uk_gdpr';

/** ICO — complaints (statutory channel for UK data subjects). */
export const ICO_COMPLAINT_URL = 'https://ico.org.uk/make-a-complaint/';

export const ICO_HOME_URL = 'https://ico.org.uk/';

/** EDPB directory of EU / EEA supervisory authorities. */
export const EDPB_MEMBERS_URL_EN = 'https://edpb.europa.eu/about-edpb/board/members_en';

export function privacyJurisdictionFromCountryCode(code: string | null | undefined): PrivacyJurisdiction {
  const c = (code ?? '').trim().toUpperCase();
  if (c === 'GB' || c === 'UK') return 'uk_gdpr';
  return 'eu_gdpr';
}

/**
 * Resolves UK vs EU privacy framing for generated documents.
 * Priority: `country` / `privacy_jurisdiction` query → `x-vercel-ip-country` (e.g. Vercel).
 */
export function privacyJurisdictionFromRequest(request: NextRequest): PrivacyJurisdiction {
  const url = request.nextUrl;
  const j = url.searchParams.get('privacy_jurisdiction')?.toLowerCase().trim();
  if (j === 'uk' || j === 'gb') return 'uk_gdpr';
  if (j === 'eu') return 'eu_gdpr';

  const qc = url.searchParams.get('country')?.trim();
  if (qc) return privacyJurisdictionFromCountryCode(qc);

  const header = request.headers.get('x-vercel-ip-country')?.trim();
  return privacyJurisdictionFromCountryCode(header);
}
