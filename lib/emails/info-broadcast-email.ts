import { getEmailTemplatesTranslator } from '@/lib/emails/email-templates-i18n';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { renderZenithEmail } from '@/lib/emails/templates';
import { SITE_LOCALE_CODES } from '@/lib/i18n/site-locales-catalog';
import {
  getInfoBroadcastTestCtaLabel,
  getInfoBroadcastTestEmailTitle,
  getSiteUrl,
} from '@/src/lib/empire-settings';

function logoBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || getSiteUrl();
}

const SUPPORTED_LOCALES = new Set<string>(SITE_LOCALE_CODES);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type GreetingRow = { withName: string; withoutName: string };
type LibEmailsMessages = {
  LibEmails?: {
    infoBroadcast?: { greetings?: Record<string, GreetingRow> };
    adminBroadcastTest?: {
      introHtml?: string;
      fingerprintPrefix?: string;
      localeHeading?: string;
      subjectLabel?: string;
      openReputexaCta?: string;
      emailTitle?: string;
    };
  };
};

function greetingParagraph(locale: string, recipientName?: string): string {
  const messages = getServerMessagesForLocale(locale) as LibEmailsMessages;
  const greetings = messages.LibEmails?.infoBroadcast?.greetings;
  const loc = SUPPORTED_LOCALES.has(locale) ? locale : 'fr';
  const row = greetings?.[loc] ?? greetings?.fr;
  if (!row) return '';
  const raw = recipientName?.trim() || '';
  const inner = raw ? row.withName.replace(/\{name\}/g, escapeHtml(raw)) : row.withoutName;
  return `<p style="margin: 0 0 16px; font-size: 15px; color: #374151;">${inner}</p>`;
}

/**
 * E-mail d’information (hors CGU) : en-tête REPUTEXA, corps HTML fourni, CTA tableau de bord optionnel.
 */
export function getInfoBroadcastEmailHtml(params: {
  locale: string;
  title: string;
  bodyHtml: string;
  recipientName?: string;
  dashboardUrl?: string;
}): string {
  const loc = SUPPORTED_LOCALES.has(params.locale) ? params.locale : 'fr';
  const greet = greetingParagraph(loc, params.recipientName);
  const content = `
    ${greet}
    <div style="font-size: 15px; color: #374151; line-height: 1.6;">${params.bodyHtml}</div>
  `.trim();

  const btnUrl = params.dashboardUrl?.trim() ?? '';
  const tMail = getEmailTemplatesTranslator(loc);

  return renderZenithEmail(
    params.title,
    content,
    btnUrl ? tMail('common.openDashboard') : '',
    btnUrl,
    undefined,
    `${logoBase().replace(/\/$/, '')}/${loc}/contact`,
    undefined,
    undefined,
    loc,
  );
}

/**
 * E-mail de test admin : aperçu de toutes les locales dans un seul message.
 */
export function getAdminBroadcastTestEmailHtml(params: {
  packs: Record<string, { subject: string; html: string }>;
  fingerprint: string;
}): string {
  const messages = getServerMessagesForLocale('fr') as LibEmailsMessages;
  const adm = messages.LibEmails?.adminBroadcastTest ?? {};
  const locales = [...SITE_LOCALE_CODES];
  const blocks = locales
    .map((loc) => {
      const p = params.packs[loc];
      if (!p) return '';
      const heading = (adm.localeHeading ?? 'Locale {locale}').replace(/\{locale\}/g, loc.toUpperCase());
      const subjectLbl = adm.subjectLabel ?? 'Sujet :';
      return `
        <div style="margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;">${escapeHtml(heading)}</p>
          <p style="margin:0 0 12px;font-size:13px;color:#475569;"><strong>${escapeHtml(subjectLbl)}</strong> ${escapeHtml(p.subject)}</p>
          <div style="font-size:14px;color:#1e293b;">${p.html}</div>
        </div>
      `;
    })
    .join('');

  const intro = adm.introHtml ?? '';
  const fpPrefix = adm.fingerprintPrefix ?? '';
  const inner = `
    <div style="margin: 0 0 16px; font-size: 15px; color: #b45309;">${intro}</div>
    <p style="margin: 0 0 20px; font-size: 12px; font-family: monospace; color: #64748b;">${escapeHtml(fpPrefix)} ${escapeHtml(params.fingerprint.slice(0, 32))}…</p>
    ${blocks}
  `.trim();

  return renderZenithEmail(
    getInfoBroadcastTestEmailTitle(),
    inner,
    getInfoBroadcastTestCtaLabel(),
    logoBase().replace(/\/$/, ''),
    undefined,
    `${logoBase().replace(/\/$/, '')}/fr/contact`,
    undefined,
    undefined,
    'fr',
  );
}
