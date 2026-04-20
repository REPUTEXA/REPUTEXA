/**
 * POST /api/consent/site — enregistre consentement cookies (auth ou anonymous_id).
 * GET /api/consent/site — statut pour bannière (optionnel user ou ?anonymous_id=).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { fetchCurrentPublishedLegal } from '@/lib/legal/current-published';
import { routing } from '@/i18n/routing';

const KNOWN_LOCALES = new Set<string>(routing.locales);

export const dynamic = 'force-dynamic';

const VALID_STATUS = new Set(['all', 'necessary', 'refused', 'partial']);

type SiteConsentRow = {
  legal_version_id: number;
  consent_status: string;
  updated_at: string;
  analytics_opt_in?: boolean;
  marketing_opt_in?: boolean;
};

/** ISO3166-1 alpha-2 ; ZZ = inconnu si pas d’en-tête géo (localhost, dev, proxy sans Vercel/Cloudflare). */
function countryFromRequest(req: NextRequest): string {
  const h = req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry');
  const c = (h ?? 'ZZ').trim().toUpperCase();
  return c.length === 2 ? c : 'ZZ';
}

function sanitizeUiLocale(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 16) : '';
  return KNOWN_LOCALES.has(s) ? s : '';
}

function sanitizeNavigatorLanguage(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 48);
}

function acceptLanguageHeaderSnippet(req: NextRequest): string {
  const h = req.headers.get('accept-language') ?? '';
  const first = h.split(',')[0]?.trim() ?? '';
  return first.slice(0, 160);
}

/** Sec-GPC: 1 — signal navigateur (GPC), à respecter comme refus des traceurs non essentiels par défaut. */
function readGlobalPrivacyControlHeader(req: NextRequest): boolean {
  const v = (req.headers.get('sec-gpc') ?? req.headers.get('Sec-GPC') ?? '').trim();
  return v === '1';
}

function guardianCookieHint(cookieInventory: unknown, locale: string): string | null {
  if (!Array.isArray(cookieInventory) || cookieInventory.length === 0) return null;
  const names = cookieInventory
    .map((item) =>
      item && typeof item === 'object' && 'name' in item && typeof (item as { name: unknown }).name === 'string'
        ? String((item as { name: string }).name).trim()
        : ''
    )
    .filter(Boolean)
    .slice(0, 14);
  if (!names.length) return null;
  const suffix = cookieInventory.length > 14 ? '…' : '';
  const t = createServerTranslator('Api', locale);
  return t('consent_cookieInventoryHint', { list: `${names.join(', ')}${suffix}` });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const published = await fetchCurrentPublishedLegal(supabase);
  const currentVersion = published?.version ?? 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const anon = req.nextUrl.searchParams.get('anonymous_id')?.trim() ?? '';

  let row: SiteConsentRow | null = null;

  if (user) {
    const { data } = await supabase
      .from('user_consents')
      .select('legal_version_id, consent_status, updated_at, analytics_opt_in, marketing_opt_in')
      .eq('user_id', user.id)
      .maybeSingle();
    row = (data as SiteConsentRow | null) ?? null;
  } else if (anon && admin) {
    const { data } = await admin
      .from('user_consents')
      .select('legal_version_id, consent_status, updated_at, analytics_opt_in, marketing_opt_in')
      .eq('anonymous_id', anon)
      .maybeSingle();
    row = (data as SiteConsentRow | null) ?? null;
  }

  /** Afficher tant qu’aucun choix enregistré, ou quand la version légale publiée a augmenté. */
  const hasValidConsent =
    !!row?.consent_status &&
    (currentVersion === 0 || row.legal_version_id >= currentVersion);
  const needsBanner = !hasValidConsent;

  const toggleDefaults = {
    analytics: !!row?.analytics_opt_in,
    marketing: !!row?.marketing_opt_in,
  };

  let cookieInventoryHint: string | null = null;
  let guardianLastRunAt: string | null = null;
  if (admin) {
    const { data: gState } = await admin
      .from('legal_guardian_state')
      .select('cookie_inventory, last_run_at')
      .eq('id', 1)
      .maybeSingle();
    if (gState?.last_run_at) {
      guardianLastRunAt = String(gState.last_run_at);
    }
    const accept = req.headers.get('accept-language') ?? '';
    const loc = accept.toLowerCase().includes('fr') ? 'fr' : 'en';
    cookieInventoryHint = guardianCookieHint(gState?.cookie_inventory, loc);
  }

  return NextResponse.json({
    currentLegalVersion: currentVersion,
    needsBanner,
    consent: row,
    toggleDefaults,
    legalEffectiveDate: published?.effective_date ?? null,
    cookieInventoryHint,
    guardianLastRunAt,
    globalPrivacyControl: readGlobalPrivacyControlHeader(req),
  });
}

type ConsentPostBody = {
  consent_status?: string;
  anonymous_id?: string | null;
  ui_locale?: string | null;
  navigator_language?: string | null;
  analytics_opt_in?: boolean;
  marketing_opt_in?: boolean;
  /** Signal GPC observé côté client (navigator) et/ou en-tête Sec-GPC sur cette requête. */
  gpc_signal_observed?: boolean;
};

const LEGACY_STATUS = new Set(['all', 'necessary', 'refused']);

function resolveConsentPayload(body: ConsentPostBody): {
  consent_status: string;
  analytics_opt_in: boolean;
  marketing_opt_in: boolean;
} | null {
  const granular =
    typeof body.analytics_opt_in === 'boolean' || typeof body.marketing_opt_in === 'boolean';
  if (granular) {
    const analytics = !!body.analytics_opt_in;
    const marketing = !!body.marketing_opt_in;
    if (analytics && marketing) {
      return { consent_status: 'all', analytics_opt_in: true, marketing_opt_in: true };
    }
    if (!analytics && !marketing) {
      return { consent_status: 'necessary', analytics_opt_in: false, marketing_opt_in: false };
    }
    return { consent_status: 'partial', analytics_opt_in: analytics, marketing_opt_in: marketing };
  }
  const status = String(body.consent_status ?? '').toLowerCase();
  if (!LEGACY_STATUS.has(status)) return null;
  if (status === 'all') return { consent_status: 'all', analytics_opt_in: true, marketing_opt_in: true };
  if (status === 'refused') {
    return { consent_status: 'refused', analytics_opt_in: false, marketing_opt_in: false };
  }
  return { consent_status: 'necessary', analytics_opt_in: false, marketing_opt_in: false };
}

export async function POST(req: NextRequest) {
  let body: ConsentPostBody;
  try {
    body = await req.json();
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const resolved = resolveConsentPayload(body);
  if (!resolved) {
    return apiJsonError(req, 'consent_payloadInvalid', 400);
  }

  if (!VALID_STATUS.has(resolved.consent_status)) {
    return apiJsonError(req, 'consent_consentInvalid', 400);
  }

  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(req, 'serverConfiguration', 500);
  }

  const published = await fetchCurrentPublishedLegal(admin);
  const legalVersionId = published?.version ?? 0;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const anon =
    typeof body.anonymous_id === 'string' && body.anonymous_id.trim().length > 8
      ? body.anonymous_id.trim().slice(0, 128)
      : null;

  if (!user && !anon) {
    return apiJsonError(req, 'consent_anonymousRequired', 400);
  }

  const country = countryFromRequest(req);
  const ua = req.headers.get('user-agent') ?? '';
  const uiLocale = sanitizeUiLocale(body.ui_locale);
  const navigatorLanguage = sanitizeNavigatorLanguage(body.navigator_language);
  const acceptLanguage = acceptLanguageHeaderSnippet(req);
  const gpcFromClient = body.gpc_signal_observed === true;
  const gpcSignalObserved = gpcFromClient || readGlobalPrivacyControlHeader(req);

  const payloadBase = {
    consent_status: resolved.consent_status,
    analytics_opt_in: resolved.analytics_opt_in,
    marketing_opt_in: resolved.marketing_opt_in,
    gpc_signal_observed: gpcSignalObserved,
    country,
    legal_version_id: legalVersionId,
    user_agent: ua.slice(0, 512),
    updated_at: new Date().toISOString(),
    ui_locale: uiLocale,
    navigator_language: navigatorLanguage,
    accept_language: acceptLanguage,
  };

  if (user) {
    const { data: ex } = await admin.from('user_consents').select('id').eq('user_id', user.id).maybeSingle();
    const row = { ...payloadBase, user_id: user.id, anonymous_id: null };
    const err = ex?.id
      ? (await admin.from('user_consents').update(row).eq('id', ex.id)).error
      : (await admin.from('user_consents').insert(row)).error;
    if (err) {
      console.error('[consent/site]', err);
      return apiJsonError(req, 'serverError', 500);
    }
  } else if (anon) {
    const { data: ex } = await admin.from('user_consents').select('id').eq('anonymous_id', anon).maybeSingle();
    const row = { ...payloadBase, user_id: null, anonymous_id: anon };
    const err = ex?.id
      ? (await admin.from('user_consents').update(row).eq('id', ex.id)).error
      : (await admin.from('user_consents').insert(row)).error;
    if (err) {
      console.error('[consent/site] anon', err);
      return apiJsonError(req, 'serverError', 500);
    }
  }

  return NextResponse.json({ ok: true, legal_version_id: legalVersionId });
}
