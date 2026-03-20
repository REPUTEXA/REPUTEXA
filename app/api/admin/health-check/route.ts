/**
 * GET /api/admin/health-check
 * Test ultra-rapide (≤ 800 ms) de tous les services critiques.
 * Réservé aux administrateurs (rôle admin en DB).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const TIMEOUT_MS = 800;

/**
 * URL publique pour tester les webhooks (Sentinel).
 * Ordre : SENTINEL_PUBLIC_URL (prod) → NEXT_PUBLIC_* → VERCEL_URL (injecté sur Vercel).
 * Évite l'alerte « Dégradé » si NEXT_PUBLIC_SITE_URL n'est pas dans .env local.
 */
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

type ServiceStatus = {
  name: string;
  status: 'ok' | 'degraded' | 'critical';
  latency_ms: number | null;
  message: string;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms)
    ),
  ]);
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const admin = createAdminClient();
    if (!admin) throw new Error('Admin client non configuré (SUPABASE_SERVICE_ROLE_KEY manquante)');
    await withTimeout(
      admin.from('profiles').select('id', { head: true, count: 'exact' }),
      TIMEOUT_MS
    );
    return { name: 'database', status: 'ok', latency_ms: Date.now() - start, message: 'Supabase OK' };
  } catch (e) {
    return {
      name: 'database',
      status: 'critical',
      latency_ms: Date.now() - start,
      message: e instanceof Error ? e.message : 'Erreur inconnue',
    };
  }
}

async function checkOpenAI(): Promise<ServiceStatus> {
  const start = Date.now();
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { name: 'openai', status: 'critical', latency_ms: 0, message: 'OPENAI_API_KEY manquante' };
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
    return { name: 'openai', status: 'ok', latency_ms: Date.now() - start, message: 'OpenAI OK' };
  } catch (e) {
    return {
      name: 'openai',
      status: 'critical',
      latency_ms: Date.now() - start,
      message: e instanceof Error ? e.message : 'Erreur',
    };
  }
}

async function checkAnthropic(): Promise<ServiceStatus> {
  const start = Date.now();
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return { name: 'anthropic', status: 'degraded', latency_ms: 0, message: 'ANTHROPIC_API_KEY manquante (fallback OpenAI actif)' };
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
    return { name: 'anthropic', status: 'ok', latency_ms: Date.now() - start, message: 'Anthropic OK' };
  } catch (e) {
    return {
      name: 'anthropic',
      status: 'degraded',
      latency_ms: Date.now() - start,
      message: `Anthropic non joignable — ${e instanceof Error ? e.message : 'Erreur'} (fallback OpenAI)`,
    };
  }
}

async function checkWhatsApp(): Promise<ServiceStatus> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) {
    return { name: 'whatsapp', status: 'degraded', latency_ms: 0, message: 'Twilio non configuré (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants)' };
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
    return { name: 'whatsapp', status: 'ok', latency_ms: Date.now() - start, message: 'Twilio OK' };
  } catch (e) {
    return {
      name: 'whatsapp',
      status: 'critical',
      latency_ms: Date.now() - start,
      message: e instanceof Error ? e.message : 'Erreur',
    };
  }
}

async function checkWebhooks(): Promise<ServiceStatus> {
  const { url: siteUrl, source } = resolvePublicSiteUrlForWebhooks();
  if (!siteUrl) {
    return {
      name: 'webhooks',
      status: 'degraded',
      latency_ms: 0,
      message:
        'Aucune URL publique : ajoutez SENTINEL_PUBLIC_URL (URL prod pour les webhooks), ou NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL dans .env.local. Sur Vercel, VERCEL_URL est utilisé si rien d’autre n’est défini.',
    };
  }
  const start = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${siteUrl}/api/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
      TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
      name: 'webhooks',
      status: 'ok',
      latency_ms: Date.now() - start,
      message: `Endpoint ${siteUrl}/api/health OK (via ${source})`,
    };
  } catch (e) {
    return {
      name: 'webhooks',
      status: 'critical',
      latency_ms: Date.now() - start,
      message: e instanceof Error ? e.message : 'Erreur',
    };
  }
}

function overallStatus(services: ServiceStatus[]): 'ok' | 'degraded' | 'critical' {
  if (services.some((s) => s.status === 'critical')) return 'critical';
  if (services.some((s) => s.status === 'degraded')) return 'degraded';
  return 'ok';
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const start = Date.now();
  const services = await Promise.all([
    checkDatabase(),
    checkOpenAI(),
    checkAnthropic(),
    checkWhatsApp(),
    checkWebhooks(),
  ]);

  return NextResponse.json({
    overall: overallStatus(services),
    services,
    checked_at: new Date().toISOString(),
    total_ms: Date.now() - start,
  });
}
