import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';

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
    console.error('[sentinel-vault] Telegram', e);
  }
}

export async function notifySentinelVaultFailure(message: string, checkedAt: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0a0a;color:#e4e4e7;padding:28px;border-radius:14px;border:1px solid #7f1d1d">
      <h1 style="margin:0 0 12px;font-size:17px;color:#fecaca">Sentinel Vault — échec de sauvegarde</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#fca5a5">${message}</p>
      <p style="margin:0;font-size:12px;color:#71717a">${new Date(checkedAt).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p>
    </div>`;

  const to = alertRecipient();
  const tasks: Promise<unknown>[] = [];
  if (canSendEmail() && to) {
    tasks.push(
      sendEmail({
        to,
        subject: '🚨 Sentinel Vault — sauvegarde hors-site en échec',
        html,
        from: DEFAULT_FROM,
      })
    );
  }
  tasks.push(sendTelegram(`🚨 <b>Sentinel Vault</b>\n\n${message}\n\n${checkedAt}`));
  await Promise.allSettled(tasks);
}
