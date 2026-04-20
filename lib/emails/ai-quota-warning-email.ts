import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { getSiteUrl } from '@/lib/site-url';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Alerte une fois par jour UTC quand le volume IA approche du plafond dur.
 */
export async function sendAiQuotaWarningEmail(userId: string, input: { used: number; soft: number; hard: number }) {
  if (!canSendEmail()) return;
  const admin = createAdminClient();
  if (!admin) return;

  const { data: profile, error } = await admin
    .from('profiles')
    .select('email, language')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile?.email?.trim()) return;

  const loc = normalizeAppLocale((profile.language as string | null) ?? undefined);
  const t = createServerTranslator('BillingEmails', loc);
  const site = getSiteUrl().replace(/\/+$/, '');
  const upgradeUrl = `${site}/${loc}/pricing`;

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#18181b;max-width:560px">
  <p style="margin:0 0 12px">${t('aiQuotaWarningIntro', {
    used: input.used,
    soft: input.soft,
    hard: input.hard,
  })}</p>
  <p style="margin:0 0 12px">${t('aiQuotaWarningBody')}</p>
  <p style="margin:0">
    <a href="${upgradeUrl}" style="color:#2563eb">${t('aiQuotaWarningCta')}</a>
  </p>
  <p style="margin:16px 0 0;font-size:12px;color:#71717a">${t('aiQuotaWarningFootnote')}</p>
</div>`;

  await sendEmail({
    to: profile.email.trim().toLowerCase(),
    subject: t('aiQuotaWarningSubject'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[ai-quota-warning-email]', err));
}
