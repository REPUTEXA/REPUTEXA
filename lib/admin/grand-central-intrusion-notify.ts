import { createTranslator } from 'next-intl';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { routing } from '@/i18n/routing';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';

function alertRecipient(): string {
  const raw = process.env.SENTINEL_ALERT_EMAIL?.trim() || process.env.RESEND_FROM?.trim() || '';
  if (!raw) return '';
  const m = raw.match(/<(.+)>/);
  return (m ? m[1] : raw).trim();
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
    console.error('[grand-central-intrusion]', e);
  }
}

export type GrandCentralIntrusionPayload = {
  kind: string;
  pathname: string;
  ip: string | null;
  ua_tail?: string | null;
  /** Locale des libellés d’alerte (dérivée du middleware). */
  locale?: string;
};

/**
 * Alertes critique Grand Central (IP refusée, etc.) — email + Telegram comme Sentinel Vault.
 */
export async function notifyGrandCentralIntrusion(payload: GrandCentralIntrusionPayload): Promise<void> {
  const { kind, pathname, ip, ua_tail } = payload;
  const locale = normalizeAppLocale(payload.locale ?? routing.defaultLocale);
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin' });

  const titleTg = t('grandCentral.intrusionTelegramTitle');
  const labelType = t('grandCentral.intrusionTelegramLabelType');
  const labelPath = t('grandCentral.intrusionTelegramLabelPath');
  const labelIp = t('grandCentral.intrusionTelegramLabelIp');
  const labelUa = t('grandCentral.intrusionTelegramLabelUa');

  const lines = [
    `<b>${escapeHtml(titleTg)}</b>`,
    `<b>${escapeHtml(labelType)}</b> ${escapeHtml(kind)}`,
    `<b>${escapeHtml(labelPath)}</b> ${escapeHtml(pathname)}`,
    `<b>${escapeHtml(labelIp)}</b> ${escapeHtml(ip ?? '—')}`,
    ua_tail ? `<b>${escapeHtml(labelUa)}</b> ${escapeHtml(ua_tail)}` : '',
    `<i>${escapeHtml(new Date().toISOString())}</i>`,
  ]
    .filter(Boolean)
    .join('\n');

  const heading = t('grandCentral.intrusionEmailHeading');
  const s = t('grandCentral.intrusionEmailSubject');
  const eType = t('grandCentral.intrusionEmailLabelType');
  const ePath = t('grandCentral.intrusionEmailLabelPath');
  const eIp = t('grandCentral.intrusionEmailLabelIp');
  const eUa = t('grandCentral.intrusionEmailLabelUa');

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0a0a;color:#e4e4e7;padding:28px;border-radius:14px;border:1px solid #7c3aed">
      <h1 style="margin:0 0 12px;font-size:17px;color:#ddd6fe">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 8px;font-size:14px;color:#e4e4e7"><strong>${escapeHtml(eType)}</strong> ${escapeHtml(kind)}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#e4e4e7"><strong>${escapeHtml(ePath)}</strong> ${escapeHtml(pathname)}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#e4e4e7"><strong>${escapeHtml(eIp)}</strong> ${escapeHtml(ip ?? '—')}</p>
      ${ua_tail ? `<p style="margin:0;font-size:12px;color:#a1a1aa"><strong>${escapeHtml(eUa)}</strong> ${escapeHtml(ua_tail)}</p>` : ''}
      <p style="margin:16px 0 0;font-size:12px;color:#71717a">${escapeHtml(new Date().toISOString())}</p>
    </div>`;

  const to = alertRecipient();
  const tasks: Promise<unknown>[] = [];
  if (canSendEmail() && to) {
    tasks.push(
      sendEmail({
        to,
        subject: s,
        html,
        from: DEFAULT_FROM,
      }),
    );
  }
  tasks.push(sendTelegram(lines));
  await Promise.allSettled(tasks);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
