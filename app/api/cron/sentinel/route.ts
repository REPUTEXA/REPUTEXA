/**
 * POST /api/cron/sentinel — Sentinel Auto-Guérison
 * Planifié toutes les 10 minutes via Vercel Cron.
 * - Vérifie chaque service (DB, OpenAI, Anthropic, WhatsApp, Webhooks)
 * - Logue dans system_incidents
 * - Envoie une alerte email + Telegram si statut ROUGE
 * - Marque auto_fixed = true si le service répond à nouveau
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const TIMEOUT_MS = 5000;
const ALERT_EMAIL = process.env.SENTINEL_ALERT_EMAIL ?? process.env.RESEND_FROM ?? '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';

type ServiceResult = {
  service: string;
  status: 'ok' | 'degraded' | 'critical';
  latency_ms: number;
  message: string;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Timeout ${ms}ms`)), ms))]);
}

async function pingDatabase(): Promise<ServiceResult> {
  const start = Date.now();
  try {
    const admin = createAdminClient();
    if (!admin) throw new Error('Service role key manquante');
    const { error } = await withTimeout(
      Promise.resolve(admin.from('profiles').select('id', { head: true, count: 'exact' })),
      TIMEOUT_MS
    ) as { error: { message?: string } | null };
    if (error) throw error;
    return { service: 'database', status: 'ok', latency_ms: Date.now() - start, message: 'Supabase OK' };
  } catch (e) {
    return { service: 'database', status: 'critical', latency_ms: Date.now() - start, message: String(e instanceof Error ? e.message : e) };
  }
}

async function pingOpenAI(): Promise<ServiceResult> {
  const start = Date.now();
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { service: 'openai', status: 'critical', latency_ms: 0, message: 'OPENAI_API_KEY manquante' };
  try {
    const res = await withTimeout(
      fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } }),
      TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { service: 'openai', status: 'ok', latency_ms: Date.now() - start, message: 'OpenAI OK' };
  } catch (e) {
    return { service: 'openai', status: 'critical', latency_ms: Date.now() - start, message: String(e instanceof Error ? e.message : e) };
  }
}

async function pingAnthropic(): Promise<ServiceResult> {
  const start = Date.now();
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { service: 'anthropic', status: 'degraded', latency_ms: 0, message: 'ANTHROPIC_API_KEY manquante (fallback actif)' };
  try {
    const res = await withTimeout(
      fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } }),
      TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { service: 'anthropic', status: 'ok', latency_ms: Date.now() - start, message: 'Anthropic OK' };
  } catch (e) {
    return { service: 'anthropic', status: 'degraded', latency_ms: Date.now() - start, message: `Anthropic dégradé: ${e instanceof Error ? e.message : e}` };
  }
}

async function pingWhatsApp(): Promise<ServiceResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) return { service: 'whatsapp', status: 'degraded', latency_ms: 0, message: 'Twilio non configuré' };
  const start = Date.now();
  try {
    const creds = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await withTimeout(
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: `Basic ${creds}` } }),
      TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { service: 'whatsapp', status: 'ok', latency_ms: Date.now() - start, message: 'Twilio OK' };
  } catch (e) {
    return { service: 'whatsapp', status: 'critical', latency_ms: Date.now() - start, message: String(e instanceof Error ? e.message : e) };
  }
}

async function pingWebhooks(): Promise<ServiceResult> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  if (!base) return { service: 'webhooks', status: 'degraded', latency_ms: 0, message: 'NEXT_PUBLIC_SITE_URL non définie' };
  const start = Date.now();
  try {
    const res = await withTimeout(fetch(`${base}/api/health`), TIMEOUT_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { service: 'webhooks', status: 'ok', latency_ms: Date.now() - start, message: 'Endpoint /api/health OK' };
  } catch (e) {
    return { service: 'webhooks', status: 'critical', latency_ms: Date.now() - start, message: String(e instanceof Error ? e.message : e) };
  }
}

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('[sentinel] Telegram alert error:', e);
  }
}

async function sendCriticalAlert(criticals: ServiceResult[], checkedAt: string): Promise<void> {
  const lines = criticals.map((s) => `• <b>${s.service.toUpperCase()}</b> — ${s.message}`).join('\n');
  const subject = `🚨 REPUTEXA Sentinel — Alerte critique (${criticals.length} service(s) en échec)`;

  const htmlEmail = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#0a0a0a;color:#e4e4e7;padding:32px;border-radius:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <div style="width:36px;height:36px;background:#ef4444;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px">🚨</div>
        <h1 style="margin:0;font-size:18px;font-weight:700;color:#fff">Alerte Sentinel REPUTEXA</h1>
      </div>
      <p style="color:#f87171;font-size:15px;font-weight:600;margin-bottom:16px">${criticals.length} service(s) en statut CRITIQUE :</p>
      ${criticals.map((s) => `
        <div style="background:#1f1f1f;border:1px solid #3f1111;border-radius:10px;padding:14px;margin-bottom:10px">
          <p style="margin:0 0 4px;font-weight:700;color:#fca5a5;font-size:14px;text-transform:uppercase">${s.service}</p>
          <p style="margin:0;color:#e4e4e7;font-size:13px">${s.message}</p>
          ${s.latency_ms ? `<p style="margin:4px 0 0;color:#71717a;font-size:12px">${s.latency_ms}ms</p>` : ''}
        </div>
      `).join('')}
      <p style="color:#71717a;font-size:12px;margin-top:20px">Vérifié le : ${new Date(checkedAt).toLocaleString('fr-FR')}</p>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/fr/dashboard/admin" style="display:inline-block;margin-top:16px;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">→ Ouvrir le Panel Admin</a>
    </div>
  `;

  const telegramMsg = `🚨 <b>REPUTEXA Sentinel — Alerte critique</b>\n\n${lines}\n\n🕐 ${new Date(checkedAt).toLocaleString('fr-FR')}`;

  const emails: Promise<unknown>[] = [];
  if (canSendEmail() && ALERT_EMAIL) {
    const to = ALERT_EMAIL.match(/<(.+)>/) ? ALERT_EMAIL.match(/<(.+)>/)![1] : ALERT_EMAIL;
    emails.push(sendEmail({ to, subject, html: htmlEmail, from: DEFAULT_FROM }));
  }
  emails.push(sendTelegram(telegramMsg));
  await Promise.allSettled(emails);
}

export async function POST(request: Request) {
  const ta = apiAdminT();
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isCronSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isVercelCron && !isCronSecret) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });

  const checkedAt = new Date().toISOString();
  const results = await Promise.all([pingDatabase(), pingOpenAI(), pingAnthropic(), pingWhatsApp(), pingWebhooks()]);

  const criticals = results.filter((r) => r.status === 'critical');
  const overall: 'ok' | 'degraded' | 'critical' =
    criticals.length > 0 ? 'critical' : results.some((r) => r.status === 'degraded') ? 'degraded' : 'ok';

  // --- Récupérer le dernier incident pour chaque service afin de détecter les auto-fixes
  const { data: lastIncidents } = await admin
    .from('system_incidents')
    .select('service, status, created_at')
    .in('service', results.map((r) => r.service))
    .order('created_at', { ascending: false })
    .limit(results.length * 3);

  const lastByService = new Map<string, string>();
  for (const inc of lastIncidents ?? []) {
    if (!lastByService.has(inc.service as string)) {
      lastByService.set(inc.service as string, inc.status as string);
    }
  }

  // --- Insérer les nouveaux enregistrements
  const rows = results.map((r) => {
    const previousStatus = lastByService.get(r.service);
    const autoFixed = r.status === 'ok' && (previousStatus === 'critical' || previousStatus === 'degraded');
    return {
      service: r.service,
      status: autoFixed ? 'auto_fixed' : r.status,
      message: autoFixed ? `Auto-réparé (était ${previousStatus}) — ${r.message}` : r.message,
      latency_ms: r.latency_ms,
      auto_fixed: autoFixed,
      alert_sent: false,
    };
  });

  const { error: insertErr } = await admin.from('system_incidents').insert(rows);
  if (insertErr) console.error('[sentinel] Insert error:', insertErr);

  // --- Envoyer alerte si critiques détectés
  if (criticals.length > 0) {
    try {
      await sendCriticalAlert(criticals, checkedAt);
      const criticalServices = criticals.map((r) => r.service);
      await admin
        .from('system_incidents')
        .update({ alert_sent: true })
        .in('service', criticalServices)
        .gte('created_at', checkedAt);
    } catch (e) {
      console.error('[sentinel] Alert error:', e);
    }
  }

  // --- Déclencher l'agent d'auto-réparation pour les services NOUVELLEMENT critiques
  // (transition depuis ok/auto_fixed → critical uniquement, pour éviter le spam)
  const newlyCritical = criticals.filter((r) => {
    const prev = lastByService.get(r.service);
    return !prev || prev === 'ok' || prev === 'auto_fixed';
  });

  if (newlyCritical.length > 0) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
    if (siteUrl && CRON_SECRET) {
      // Fire-and-forget : on n'attend pas la réponse pour ne pas bloquer le cron
      fetch(`${siteUrl}/api/admin/auto-heal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      }).catch((e) => console.error('[sentinel] auto-heal trigger failed:', e));
      console.info(`[sentinel] Auto-heal déclenché pour : ${newlyCritical.map((r) => r.service).join(', ')}`);
    }
  }

  console.info(`[sentinel] ${checkedAt} — overall: ${overall} — critiques: ${criticals.length}`);

  return NextResponse.json({ overall, services: results, checked_at: checkedAt });
}
