import { createTranslator } from 'next-intl';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import type { EmailLocale } from '@/lib/emails/auth-email-i18n';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { getBrandName } from '@/src/lib/empire-settings';

function tNewsletter(locale: string | null | undefined) {
  const loc = normalizeAppLocale(locale);
  const messages = getServerMessagesForLocale(loc);
  return createTranslator({ locale: loc, messages, namespace: 'NewsletterEmails' });
}

function publicUrl(siteUrl: string, locale: EmailLocale, path: string): string {
  const base = siteUrl.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}/${locale}${p}`;
}

/**
 * Lien public de désabonnement : même locale que l’e-mail (path + `locale` en query pour clients
 * qui tronquent le chemin ou réécrivent l’URL).
 */
export function buildNewsletterUnsubscribeUrl(
  siteUrl: string,
  locale: string | null | undefined,
  email: string
): string {
  const loc = normalizeAppLocale(locale);
  const base = siteUrl.replace(/\/$/, '');
  const q = new URLSearchParams();
  q.set('email', email);
  q.set('locale', loc);
  return `${base}/${loc}/newsletter/unsubscribe?${q.toString()}`;
}

export function buildNewsletterWelcomeEmail(
  locale: string | null | undefined,
  email: string,
  siteUrl: string
): { subject: string; html: string; resolvedLocale: EmailLocale } {
  const loc = normalizeAppLocale(locale) as EmailLocale;
  const t = tNewsletter(loc);
  const unsubscribeUrl = buildNewsletterUnsubscribeUrl(siteUrl, loc, email);
  const blogUrl = publicUrl(siteUrl, loc, '/blog');

  const subject = t('welcome.subject');
  const html = `<!DOCTYPE html>
<html lang="${t('welcome.htmlLang')}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(t('welcome.docTitle'))}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:560px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background:#2563eb;padding:32px 36px 28px;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td align="center" style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:14px;">
                    <span style="display:block;font-size:24px;font-weight:900;color:#ffffff;line-height:48px;letter-spacing:-0.02em;">R</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#ffffff;text-transform:uppercase;">${escapeHtml(getBrandName())}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 12px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.35;">
                ${escapeHtml(t('welcome.h1'))}
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.75;">
                ${escapeHtml(t('welcome.intro'))}
              </p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.5;">
                    <span style="color:#2563eb;font-weight:700;margin-right:10px;">✓</span>${escapeHtml(t('welcome.bullet1'))}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.5;">
                    <span style="color:#2563eb;font-weight:700;margin-right:10px;">✓</span>${escapeHtml(t('welcome.bullet2'))}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.5;">
                    <span style="color:#2563eb;font-weight:700;margin-right:10px;">✓</span>${escapeHtml(t('welcome.bullet3'))}
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:12px;background:#2563eb;">
                    <a href="${blogUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:12px;">
                      ${escapeHtml(t('welcome.ctaBlog'))}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(t('welcome.signature'))}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7;">
                ${escapeHtml(t('welcome.footerReason'))}<br />
                <a href="${unsubscribeUrl}" style="color:#2563eb;text-decoration:none;">${escapeHtml(t('welcome.unsubscribe'))}</a> &nbsp;·&nbsp; ${escapeHtml(t('welcome.footerOrg'))}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, resolvedLocale: loc };
}

export function buildNewsletterUnsubscribeConfirmationEmail(
  locale: string | null | undefined,
  siteUrl: string
): { subject: string; html: string; resolvedLocale: EmailLocale } {
  const loc = normalizeAppLocale(locale) as EmailLocale;
  const t = tNewsletter(loc);
  const blogUrl = publicUrl(siteUrl, loc, '/blog');

  const subject = t('unsubscribeConfirm.subject');
  const html = `<!DOCTYPE html>
<html lang="${t('unsubscribeConfirm.htmlLang')}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${escapeHtml(t('unsubscribeConfirm.docTitle'))}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:560px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background:#2563eb;padding:32px 36px 28px;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td align="center" style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:14px;">
                    <span style="display:block;font-size:24px;font-weight:900;color:#ffffff;line-height:48px;letter-spacing:-0.02em;">R</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#ffffff;text-transform:uppercase;">${escapeHtml(getBrandName())}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 12px;text-align:center;">
              <div style="width:56px;height:56px;background:#f0fdf4;border-radius:50%;margin:0 auto 20px;line-height:56px;font-size:28px;">✓</div>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.35;">
                ${escapeHtml(t('unsubscribeConfirm.h1'))}
              </h1>
              <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.75;">
                ${escapeHtml(t('unsubscribeConfirm.body1'))}
              </p>
              <p style="margin:0 0 32px;font-size:14px;color:#475569;line-height:1.75;">
                ${escapeHtml(t('unsubscribeConfirm.body2'))}
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:12px;background:#2563eb;">
                    <a href="${blogUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:12px;">
                      ${escapeHtml(t('unsubscribeConfirm.ctaBlog'))}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(t('unsubscribeConfirm.signature'))}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7;text-align:center;">
                ${escapeHtml(t('unsubscribeConfirm.footerNote'))}<br/>
                ${escapeHtml(t('unsubscribeConfirm.footerOrg'))}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, resolvedLocale: loc };
}

export function buildWeeklyForgeBroadcastEmail(opts: {
  locale: string;
  title: string;
  excerpt: string;
  readTime: string;
  articleUrl: string;
  dateLabel: string;
  email: string;
  siteUrl: string;
}): { subject: string; html: string } {
  const t = tNewsletter(opts.locale);
  const brand = getBrandName();
  const mono = brand.charAt(0).toUpperCase();
  const unsubscribeUrl = buildNewsletterUnsubscribeUrl(opts.siteUrl, opts.locale, opts.email);
  const subject = `${t('weeklyForge.subjectPrefix')}${opts.title}`;
  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(t('weeklyForge.htmlLang'))}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(t('weeklyForge.docTitle', { title: opts.title }))}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:560px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background:#2563eb;padding:32px 36px 28px;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td align="center" style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:14px;">
                    <span style="display:block;font-size:24px;font-weight:900;color:#ffffff;line-height:48px;letter-spacing:-0.02em;">${escapeHtml(mono)}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#ffffff;text-transform:uppercase;">${escapeHtml(brand)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 12px;">
              <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#2563eb;letter-spacing:0.1em;text-transform:uppercase;">
                ${escapeHtml(t('weeklyForge.kicker', { date: opts.dateLabel }))}
              </p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.35;">
                ${escapeHtml(opts.title)}
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.75;">
                ${escapeHtml(opts.excerpt)}
              </p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.5;">
                    <span style="color:#2563eb;font-weight:700;margin-right:10px;">✓</span>${escapeHtml(t('weeklyForge.bullet1'))}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.5;">
                    <span style="color:#2563eb;font-weight:700;margin-right:10px;">✓</span>${escapeHtml(t('weeklyForge.bullet2'))}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#1e293b;line-height:1.5;">
                    <span style="color:#2563eb;font-weight:700;margin-right:10px;">✓</span>${escapeHtml(t('weeklyForge.bullet3'))}
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:12px;color:#94a3b8;">
                ${escapeHtml(t('weeklyForge.readingLabel', { readTime: opts.readTime }))} · ${escapeHtml(t('weeklyForge.byline', { brand }))}
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:12px;background:#2563eb;">
                    <a href="${opts.articleUrl.replace(/&/g, '&amp;')}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:12px;">
                      ${escapeHtml(t('weeklyForge.cta'))}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(t('weeklyForge.signature', { brand }))}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7;">
                ${escapeHtml(t('weeklyForge.footerSubscribed', { brand }))}<br/>
                <a href="${unsubscribeUrl}" style="color:#2563eb;text-decoration:none;">${escapeHtml(t('weeklyForge.unsubscribe'))}</a> &nbsp;·&nbsp; ${escapeHtml(t('weeklyForge.footerOrg', { brand }))}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
