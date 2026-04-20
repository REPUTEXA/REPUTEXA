import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createTranslator } from 'next-intl';

import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { PLAN_BASE_PRICES_EUR, getStripePriceId, type PlanSlug } from '@/config/pricing';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { legalTodayUtc } from '@/lib/legal/dates';

export const SENTINEL_360_CONFIG_KEY = 'sentinel_360';

export type Sentinel360AutoFrequency = 'off' | 'daily' | 'weekly';

export type Sentinel360StoredConfig = {
  autoFrequency: Sentinel360AutoFrequency;
  lastAutoScanAt?: string | null;
};

export type SentinelPhaseKey = 'legal' | 'compliance' | 'consistency' | 'payment';

export type SentinelFindingSeverity = 'ok' | 'info' | 'warning' | 'critical';

export type SentinelFinding = {
  phase: SentinelPhaseKey;
  id: string;
  title: string;
  detail: string;
  severity: SentinelFindingSeverity;
};

export type SentinelFixProposal = {
  id: string;
  label: string;
  description: string;
  /** Exécuté côté serveur si `action` non vide */
  action: 'trigger_guardian' | 'none';
  /** Navigation dashboard (relatif, sans locale) */
  clientRoute?: string;
};

export type Sentinel360AuditReport = {
  scannedAt: string;
  phases: { key: SentinelPhaseKey; label: string; status: 'done' }[];
  findings: SentinelFinding[];
  fixProposals: SentinelFixProposal[];
  summaryCounts: {
    critical: number;
    warning: number;
    info: number;
    ok: number;
  };
  featureFlags: Record<string, boolean>;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolvePublicBaseUrl(): string {
  const candidates = [
    process.env.SENTINEL_PUBLIC_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : '',
  ];
  for (const c of candidates) {
    const u = String(c ?? '')
      .trim()
      .replace(/\/$/, '');
    if (u) return u;
  }
  return '';
}

const SIRET_REGEX = /\b\d{3}[\s\u00A0]?\d{3}[\s\u00A0]?\d{3}[\s\u00A0]?\d{5}\b|\b\d{14}\b/;
const AI_HINTS =
  /openai|anthropic|claude|gpt[-\s]?[34]o|intelligence artificielle|modèle linguistique|générative|\bllm\b/i;
const WA_HINTS = /whatsapp|meta platforms|meta ireland|business platform/i;
const COOKIE_HINTS = /cookie|traceur|consentement|eprivacy|bandeau/i;

type LegalRow = {
  document_type: string;
  version: number;
  content: string | null;
  effective_date: string | null;
  status: string | null;
};

function pickLatestPublishedLegal(rows: LegalRow[], todayUtc: string): Map<string, LegalRow> {
  const active = rows.filter((r) => {
    const st = String(r.status ?? 'ACTIVE').toUpperCase();
    if (st !== 'ACTIVE') return false;
    const ed = r.effective_date;
    if (ed && ed > todayUtc) return false;
    return true;
  });
  const byType = new Map<string, LegalRow>();
  for (const r of active) {
    const prev = byType.get(r.document_type);
    if (!prev || r.version > prev.version) byType.set(r.document_type, r);
  }
  return byType;
}

async function headPath(base: string, path: string): Promise<{ ok: boolean; status: number }> {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Sentinel 360° audit — deterministic heuristics (legal, GDPR, consistency, payments).
 * Does not replace a human legal review.
 */
export async function runSentinel360Audit(
  admin: SupabaseClient,
  opts?: { logToCompliance?: boolean }
): Promise<Sentinel360AuditReport> {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin.sentinel360Audit' });

  const scannedAt = new Date().toISOString();
  const todayUtc = legalTodayUtc();

  const featureFlags = {
    openai: !!process.env.OPENAI_API_KEY?.trim(),
    anthropic: !!process.env.ANTHROPIC_API_KEY?.trim(),
    whatsapp:
      !!process.env.WHATSAPP_TOKEN?.trim() ||
      !!process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
      !!process.env.META_WHATSAPP_TOKEN?.trim(),
    stripe: !!process.env.STRIPE_SECRET_KEY?.trim(),
  };

  const findings: SentinelFinding[] = [];
  const phases: Sentinel360AuditReport['phases'] = [
    { key: 'legal', label: t('phaseLabel_legal'), status: 'done' },
    { key: 'compliance', label: t('phaseLabel_compliance'), status: 'done' },
    { key: 'consistency', label: t('phaseLabel_consistency'), status: 'done' },
    { key: 'payment', label: t('phaseLabel_payment'), status: 'done' },
  ];

  const { data: legalData, error: legalErr } = await admin
    .from('legal_versioning')
    .select('document_type, version, content, effective_date, status')
    .order('version', { ascending: false });

  if (legalErr) {
    findings.push({
      phase: 'legal',
      id: 'legal_db',
      title: 'Lecture des documents publiés impossible',
      detail: legalErr.message,
      severity: 'critical',
    });
  } else {
    const latest = pickLatestPublishedLegal((legalData ?? []) as LegalRow[], todayUtc);
    const cgu = latest.get('cgu');
    const privacy = latest.get('politique_confidentialite');
    const mentions = latest.get('mentions_legales');

    if (!cgu || !privacy || !mentions) {
      const miss: string[] = [];
      if (!cgu) miss.push(t('docLabel_cgu'));
      if (!privacy) miss.push(t('docLabel_privacy'));
      if (!mentions) miss.push(t('docLabel_mentions'));
      const missing = miss.length ? miss.join(', ') : t('unknownMissing');
      findings.push({
        phase: 'legal',
        id: 'legal_missing_doc',
        title: t('legalMissingDocTitle'),
        detail: t('legalMissingDocDetail', { missing }),
        severity: 'warning',
      });
    }

    const combined = [cgu, privacy, mentions]
      .filter(Boolean)
      .map((r) => stripHtml(String(r!.content ?? '')))
      .join('\n');

    const mentionsText = mentions ? stripHtml(String(mentions.content ?? '')) : '';

    if (featureFlags.openai && combined && !AI_HINTS.test(combined)) {
      findings.push({
        phase: 'legal',
        id: 'legal_ai_gap',
        title: t('legalAiGapTitle'),
        detail: t('legalAiGapDetail'),
        severity: 'warning',
      });
    }

    if (featureFlags.whatsapp && combined && !WA_HINTS.test(combined)) {
      findings.push({
        phase: 'legal',
        id: 'legal_whatsapp_gap',
        title: t('legalWhatsappGapTitle'),
        detail: t('legalWhatsappGapDetail'),
        severity: 'warning',
      });
    }

    if (combined && !COOKIE_HINTS.test(combined)) {
      findings.push({
        phase: 'legal',
        id: 'legal_cookie_mention',
        title: t('legalCookieMentionTitle'),
        detail: t('legalCookieMentionDetail'),
        severity: 'info',
      });
    }

    if (mentionsText && !SIRET_REGEX.test(mentionsText)) {
      findings.push({
        phase: 'legal',
        id: 'legal_siret',
        title: t('legalSiretTitle'),
        detail: t('legalSiretDetail'),
        severity: 'warning',
      });
    }
  }

  const { data: guardian } = await admin.from('legal_guardian_state').select('*').eq('id', 1).maybeSingle();

  if (guardian?.last_run_at) {
    const ageMs = Date.now() - new Date(String(guardian.last_run_at)).getTime();
    const days = ageMs / 86400000;
    if (days > 14) {
      findings.push({
        phase: 'compliance',
        id: 'guardian_stale',
        title: 'Veille Legal Guardian ancienne',
        detail: `Dernier cycle Guardian : il y a ${Math.floor(days)} j. Une relance réduit le risque réglementaire.`,
        severity: 'warning',
      });
    } else {
      findings.push({
        phase: 'compliance',
        id: 'guardian_recent',
        title: 'Legal Guardian exécuté récemment',
        detail: `Statut : ${String(guardian.last_status ?? '—')} — ${String(guardian.last_summary ?? '').slice(0, 280)}`,
        severity: 'ok',
      });
    }
  } else {
    findings.push({
      phase: 'compliance',
      id: 'guardian_never',
      title: 'Aucun run Guardian enregistré',
      detail: 'Planifiez /api/cron/legal-guardian ou déclenchez une veille depuis ce panneau.',
      severity: 'warning',
    });
  }

  const zones = guardian?.compliance_zones as Record<string, { status?: string }> | undefined;
  if (zones && typeof zones === 'object') {
    const bad = Object.entries(zones).filter(([, v]) => v?.status === 'action_required');
    if (bad.length > 0) {
      findings.push({
        phase: 'compliance',
        id: 'zones_action',
        title: t('zonesActionTitle'),
        detail: t('zonesActionDetail', {
          count: bad.length,
          zones: bad.map(([k]) => k).join(', '),
        }),
        severity: 'critical',
      });
    }
  }

  const consentSince = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: consentCount } = await admin
    .from('user_consents')
    .select('id', { count: 'exact', head: true })
    .gte('updated_at', consentSince);

  if ((consentCount ?? 0) === 0) {
    findings.push({
      phase: 'compliance',
      id: 'consents_sparse',
      title: t('consentsSparseTitle'),
      detail: t('consentsSparseDetail'),
      severity: 'info',
    });
  } else {
    findings.push({
      phase: 'compliance',
      id: 'consents_ok',
      title: t('consentsOkTitle'),
      detail: t('consentsOkDetail', { count: consentCount ?? 0 }),
      severity: 'ok',
    });
  }

  const base = resolvePublicBaseUrl();
  if (!base) {
    findings.push({
      phase: 'consistency',
      id: 'public_url',
      title: t('publicUrlTitle'),
      detail: t('publicUrlDetail'),
      severity: 'warning',
    });
  } else {
    const checks = [
      ['/fr/legal/cgu', t('pageCheck_cgu')],
      ['/fr/legal/confidentialite', t('pageCheck_privacy')],
      ['/fr/legal/mentions-legales', t('pageCheck_mentions')],
      ['/fr/contact', t('pageCheck_contact')],
      ['/fr/pricing', t('pageCheck_pricing')],
    ];
    for (const [path, label] of checks) {
      const { ok, status } = await headPath(base, path);
      if (!ok) {
        const statusLabel = status ? String(status) : t('networkError');
        findings.push({
          phase: 'consistency',
          id: `link_${path}`,
          title: t('linkCheckTitle', { label }),
          detail: t('linkCheckDetail', { path, status: statusLabel, base }),
          severity: status === 404 ? 'critical' : 'warning',
        });
      }
    }
    if (!findings.some((f) => f.id.startsWith('link_'))) {
      findings.push({
        phase: 'consistency',
        id: 'links_ok',
        title: t('linksOkTitle'),
        detail: t('linksOkDetail'),
        severity: 'ok',
      });
    }
  }

  const visionEur = PLAN_BASE_PRICES_EUR.vision * 100;
  if (featureFlags.stripe) {
    const secret = process.env.STRIPE_SECRET_KEY!;
    try {
      const stripe = new Stripe(secret);
      const plan: PlanSlug = 'vision';
      const priceId = getStripePriceId(plan, false);
      if (!priceId) {
        findings.push({
          phase: 'payment',
          id: 'stripe_price_env',
          title: t('stripePriceEnvTitle'),
          detail: t('stripePriceEnvDetail'),
          severity: 'warning',
        });
      } else {
        const price = await stripe.prices.retrieve(priceId);
        const unit = price.unit_amount;
        if (unit != null && price.billing_scheme === 'per_unit') {
          if (Math.abs(unit - visionEur) > 50) {
            findings.push({
              phase: 'payment',
              id: 'stripe_price_drift',
              title: t('stripePriceDriftTitle'),
              detail: t('stripePriceDriftDetail', {
                stripeAmount: String(unit / 100),
                configAmount: String(PLAN_BASE_PRICES_EUR.vision),
              }),
              severity: 'info',
            });
          } else {
            findings.push({
              phase: 'payment',
              id: 'stripe_align',
              title: t('stripeAlignTitle'),
              detail: t('stripeAlignDetail', { amount: String(PLAN_BASE_PRICES_EUR.vision) }),
              severity: 'ok',
            });
          }
        } else {
          findings.push({
            phase: 'payment',
            id: 'stripe_graduated',
            title: t('stripeGraduatedTitle'),
            detail: t('stripeGraduatedDetail'),
            severity: 'info',
          });
        }
      }
    } catch (e) {
      findings.push({
        phase: 'payment',
        id: 'stripe_err',
        title: t('stripeErrTitle'),
        detail: t('stripeErrDetail', { message: e instanceof Error ? e.message : String(e) }),
        severity: 'warning',
      });
    }
  } else {
    findings.push({
      phase: 'payment',
      id: 'stripe_off',
      title: t('stripeOffTitle'),
      detail: t('stripeOffDetail'),
      severity: 'info',
    });
  }

  const summaryCounts = findings.reduce(
    (acc, f) => {
      acc[f.severity]++;
      return acc;
    },
    { critical: 0, warning: 0, info: 0, ok: 0 }
  );

  const fixProposals: SentinelFixProposal[] = [
    {
      id: 'trigger_guardian',
      label: t('fixTriggerGuardianLabel'),
      description: t('fixTriggerGuardianDesc'),
      action: 'trigger_guardian',
    },
    {
      id: 'open_compliance',
      label: t('fixOpenComplianceLabel'),
      description: t('fixOpenComplianceDesc'),
      action: 'none',
      clientRoute: '/dashboard/admin/compliance',
    },
  ];

  if (opts?.logToCompliance) {
    const crit = summaryCounts.critical;
    const warn = summaryCounts.warning;
    await admin.from('legal_compliance_logs').insert({
      event_type: 'ai_audit',
      message: t('complianceLogMessage', { crit, warn, total: findings.length }),
      metadata: {
        kind: 'sentinel_360',
        scannedAt,
        summaryCounts,
        findingIds: findings.map((f) => f.id),
        featureFlags,
      },
      legal_version: null,
    });
  }

  return {
    scannedAt,
    phases,
    findings,
    fixProposals,
    summaryCounts,
    featureFlags,
  };
}

export async function loadSentinel360Config(
  admin: SupabaseClient
): Promise<Sentinel360StoredConfig> {
  const { data } = await admin
    .from('legal_config')
    .select('value')
    .eq('key', SENTINEL_360_CONFIG_KEY)
    .maybeSingle();
  const v = data?.value as Record<string, unknown> | undefined;
  const freq = v?.autoFrequency;
  const autoFrequency: Sentinel360AutoFrequency =
    freq === 'daily' || freq === 'weekly' ? freq : 'off';
  const lastAutoScanAt = typeof v?.lastAutoScanAt === 'string' ? v.lastAutoScanAt : null;
  return { autoFrequency, lastAutoScanAt };
}

export async function saveSentinel360Config(
  admin: SupabaseClient,
  patch: Partial<Sentinel360StoredConfig>
): Promise<Sentinel360StoredConfig> {
  const current = await loadSentinel360Config(admin);
  const next: Sentinel360StoredConfig = {
    autoFrequency: patch.autoFrequency ?? current.autoFrequency,
    lastAutoScanAt: patch.lastAutoScanAt !== undefined ? patch.lastAutoScanAt : current.lastAutoScanAt,
  };
  await admin.from('legal_config').upsert({
    key: SENTINEL_360_CONFIG_KEY,
    value: next,
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });
  return next;
}

export function shouldRunAutoScan(
  config: Sentinel360StoredConfig,
  nowMs: number = Date.now()
): boolean {
  if (config.autoFrequency === 'off') return false;
  const last = config.lastAutoScanAt ? new Date(config.lastAutoScanAt).getTime() : 0;
  if (config.autoFrequency === 'daily') {
    return nowMs - last > 20 * 3600000;
  }
  if (config.autoFrequency === 'weekly') {
    return nowMs - last > 7 * 86400000;
  }
  return false;
}
