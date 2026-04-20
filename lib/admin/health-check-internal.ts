/**
 * Logique partagée du health-check admin (évite un fetch HTTP interne
 * qui passerait par le middleware IP Grand Central).
 */

import { createTranslator } from 'next-intl';

import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { createAdminClient } from '@/lib/supabase/admin';

const TIMEOUT_MS = 800;

/** GET public /api/health (cold start, réseau) : 800 ms provoque souvent « aborted due to timeout » ; délai dédié. */
const WEBHOOK_HEALTH_TIMEOUT_MS = 5000;

function resolvePublicSiteUrlForWebhooks(): { url: string; source: string } {
  const candidates: Array<{ env: string; value: string }> = [
    { env: 'SENTINEL_PUBLIC_URL', value: process.env.SENTINEL_PUBLIC_URL ?? '' },
    { env: 'NEXT_PUBLIC_SITE_URL', value: process.env.NEXT_PUBLIC_SITE_URL ?? '' },
    { env: 'NEXT_PUBLIC_APP_URL', value: process.env.NEXT_PUBLIC_APP_URL ?? '' },
    {
      env: 'VERCEL_URL',
      value: process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
        : '',
    },
  ];
  for (const { env, value } of candidates) {
    const url = value.trim().replace(/\/$/, '');
    if (url) return { url, source: env };
  }
  return { url: '', source: '' };
}

export type AdminHealthServiceStatus = {
  name: string;
  status: 'ok' | 'degraded' | 'critical';
  latency_ms: number | null;
  message: string;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms)),
  ]);
}

async function checkDatabase(
  t: ReturnType<typeof createTranslator>
): Promise<AdminHealthServiceStatus> {
  const start = Date.now();
  try {
    const admin = createAdminClient();
    if (!admin) throw new Error(t('databaseAdminClientMissing'));
    await withTimeout(
      Promise.resolve(admin.from('profiles').select('id', { head: true, count: 'exact' })),
      TIMEOUT_MS
    );
    return { name: 'database', status: 'ok', latency_ms: Date.now() - start, message: t('databaseOk') };
  } catch (e) {
    return {
      name: 'database',
      status: 'critical',
      latency_ms: Date.now() - start,
      message: e instanceof Error ? e.message : t('errorUnknown'),
    };
  }
}

async function checkOpenAI(
  t: ReturnType<typeof createTranslator>
): Promise<AdminHealthServiceStatus> {
  const start = Date.now();
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { name: 'openai', status: 'critical', latency_ms: 0, message: t('openaiMissingKey') };
  }
  try {
    const res = await withTimeout(
      fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
      TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: 'openai', status: 'ok', latency_ms: Date.now() - start, message: t('openaiOk') };
  } catch (e) {
    return {
      name: 'openai',
      status: 'critical',
      latency_ms: Date.now() - start,
      message: e instanceof Error ? e.message : t('errorUnknown'),
    };
  }
}

async function checkAnthropic(
  t: ReturnType<typeof createTranslator>
): Promise<AdminHealthServiceStatus> {
  const start = Date.now();
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return {
      name: 'anthropic',
      status: 'degraded',
      latency_ms: 0,
      message: t('anthropicMissingKey'),
    };
  }
  try {
    const res = await withTimeout(
      fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
      TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
      name: 'anthropic',
      status: 'ok',
      latency_ms: Date.now() - start,
      message: t('anthropicOk'),
    };
  } catch (e) {
    return {
      name: 'anthropic',
      status: 'degraded',
      latency_ms: Date.now() - start,
      message: t('anthropicUnreachable', {
        error: e instanceof Error ? e.message : t('errorGeneric'),
      }),
    };
  }
}

async function checkWhatsApp(
  t: ReturnType<typeof createTranslator>
): Promise<AdminHealthServiceStatus> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) {
    return {
      name: 'whatsapp',
      status: 'degraded',
      latency_ms: 0,
      message: t('twilioMissing'),
    };
  }
  const start = Date.now();
  try {
    const creds = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await withTimeout(
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${creds}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
      TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: 'whatsapp', status: 'ok', latency_ms: Date.now() - start, message: t('twilioOk') };
  } catch (e) {
    return {
      name: 'whatsapp',
      status: 'critical',
      latency_ms: Date.now() - start,
      message: e instanceof Error ? e.message : t('errorGeneric'),
    };
  }
}

async function checkWebhooks(
  t: ReturnType<typeof createTranslator>
): Promise<AdminHealthServiceStatus> {
  const { url: siteUrl, source } = resolvePublicSiteUrlForWebhooks();
  if (!siteUrl) {
    return {
      name: 'webhooks',
      status: 'degraded',
      latency_ms: 0,
      message: t('webhooksNoPublicUrl'),
    };
  }
  const start = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${siteUrl}/api/health`, { signal: AbortSignal.timeout(WEBHOOK_HEALTH_TIMEOUT_MS) }),
      WEBHOOK_HEALTH_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
      name: 'webhooks',
      status: 'ok',
      latency_ms: Date.now() - start,
      message: t('webhooksEndpointOk', {
        siteUrl,
        source,
        timeoutMs: WEBHOOK_HEALTH_TIMEOUT_MS,
      }),
    };
  } catch (e) {
    return {
      name: 'webhooks',
      status: 'critical',
      latency_ms: Date.now() - start,
      message: e instanceof Error ? e.message : t('errorUnknown'),
    };
  }
}

function overallStatus(services: AdminHealthServiceStatus[]): 'ok' | 'degraded' | 'critical' {
  if (services.some((s) => s.status === 'critical')) return 'critical';
  if (services.some((s) => s.status === 'degraded')) return 'degraded';
  return 'ok';
}

export async function runAdminHealthCheckServices(): Promise<{
  overall: 'ok' | 'degraded' | 'critical';
  services: AdminHealthServiceStatus[];
  checked_at: string;
  total_ms: number;
}> {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin.internalHealth' });

  const start = Date.now();
  const services = await Promise.all([
    checkDatabase(t),
    checkOpenAI(t),
    checkAnthropic(t),
    checkWhatsApp(t),
    checkWebhooks(t),
  ]);
  return {
    overall: overallStatus(services),
    services,
    checked_at: new Date().toISOString(),
    total_ms: Date.now() - start,
  };
}

export async function computeAdminIntegrationsOverall(): Promise<'ok' | 'degraded' | 'critical'> {
  const { overall } = await runAdminHealthCheckServices();
  return overall;
}
