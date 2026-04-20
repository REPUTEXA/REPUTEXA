import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { getSiteUrl } from '@/lib/site-url';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SUPPORT =
  process.env.SUPPORT_EMAIL?.trim() || process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@reputexa.fr';

/**
 * Après résiliation Stripe : demande courte de retour (amélioration produit).
 */
export async function sendChurnSurveyEmail(params: {
  to: string;
  locale?: string | null;
  establishmentName?: string | null;
  fullName?: string | null;
}): Promise<void> {
  if (!canSendEmail()) return;
  const to = params.to.trim().toLowerCase();
  if (!to || !to.includes('@')) return;

  const loc = normalizeAppLocale(params.locale ?? undefined);
  const t = createServerTranslator('BillingEmails', loc);
  const site = getSiteUrl().replace(/\/+$/, '');
  const contactUrl = `${site}/${loc}/contact`;
  const mailtoHref = `mailto:${SUPPORT}?subject=${encodeURIComponent(t('churnSurveyMailtoSubject'))}&body=${encodeURIComponent(t('churnSurveyMailtoBody'))}`;

  const displayName =
    params.fullName?.trim() ||
    params.establishmentName?.trim() ||
    t('churnSurveyFallbackName');

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#18181b;max-width:560px">
  <p style="margin:0 0 12px">${t('churnSurveyGreeting', { name: esc(displayName) })}</p>
  <p style="margin:0 0 12px">${t('churnSurveyBody')}</p>
  <p style="margin:0 0 12px">
    <a href="${contactUrl}" style="color:#2563eb">${t('churnSurveyContactCta')}</a>
  </p>
  <p style="margin:0">
    <a href="${mailtoHref}" style="color:#2563eb">${t('churnSurveyMailtoCta')}</a>
  </p>
  <p style="margin:16px 0 0;font-size:12px;color:#71717a">${t('churnSurveyFooter')}</p>
</div>`;

  await sendEmail({
    to,
    subject: t('churnSurveySubject'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
    replyTo: SUPPORT,
  }).catch((err) => console.error('[churn-survey-email]', err));
}
