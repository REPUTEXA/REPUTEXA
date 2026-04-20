import { SITE_LOCALE_CODES, siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { buildZenithShellCopy, normalizeEmailLocale } from '@/lib/emails/auth-email-i18n';
import { getEmailTemplatesTranslator } from '@/lib/emails/email-templates-i18n';
import { getSiteUrl } from '@/src/lib/empire-settings';

/** Polices compatibles : Gmail, Outlook, Apple Mail */
const FONT_FALLBACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** URL publique du site pour le logo (`targets/settings.json` > env). */
function logoBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || getSiteUrl();
}

function te(locale?: string) {
  return getEmailTemplatesTranslator(locale);
}

function supportUrlForLocale(locale?: string): string {
  const loc = normalizeEmailLocale(locale);
  return `${logoBase().replace(/\/$/, '')}/${loc}/contact`;
}

/** Lien secondaire optionnel affiché sous le CTA (ex. annulation essai). */
export type ZenithEmailSecondaryLink = { text: string; url: string };

/**
 * Template maître Zenith : header bleu REPUTEXA (logo HD), contenu, CTA, lien secondaire optionnel, footer.
 * Textes shell via AuthEmails + EmailTemplates.common (messages/fr.json, héritage locales).
 */
export function renderZenithEmail(
  title: string,
  content: string,
  buttonText: string,
  buttonUrl: string,
  otpCode?: string,
  supportUrl?: string,
  secondaryLink?: ZenithEmailSecondaryLink,
  otpEmail?: string,
  locale?: string
): string {
  const loc = normalizeEmailLocale(locale);
  const shell = buildZenithShellCopy(loc);
  const t = te(loc);

  const opts = {
    title,
    content,
    buttonText,
    buttonUrl,
    otpCode: otpCode && /^\d{6}$/.test(otpCode) ? otpCode : undefined,
    supportUrl: supportUrl ?? null,
    secondaryLink: secondaryLink ?? null,
    otpEmail: otpEmail ?? null,
  };

  const baseUrl = logoBase();
  const logoImgUrl = `${baseUrl}/logo-hd.png`;
  const hasOtp = !!opts.otpCode;
  const hasButton = !!opts.buttonText && !!opts.buttonUrl;
  const baseNoSlash = baseUrl.replace(/\/$/, '');

  const ctaBlock = hasOtp
    ? `
    <div style="margin: 24px 0 0; text-align: center;">
      <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; font-weight: 600;">${shell.otpVerificationTitle}</p>
      <a href="${baseNoSlash}/${loc}/confirm-email?code=${opts.otpCode}${opts.otpEmail ? '&email=' + encodeURIComponent(opts.otpEmail) : ''}"
         style="display:inline-block;font-size:40px;font-weight:800;letter-spacing:0.30em;color:#0f172a !important;font-family:'SF Mono',Monaco,'Courier New',Consolas,monospace;text-decoration:none;border-bottom:none;cursor:pointer;"
         title="${shell.otpCodeLinkTitle}">${opts.otpCode}</a>
      <p style="margin: 14px 0 0; font-size: 13px; color: #94a3b8;">${shell.otpClickHint}</p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #cbd5e1;">${shell.otpValidityHint}</p>
      ${hasButton ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;"><tr><td><a href="${opts.buttonUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff !important;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-family:${FONT_FALLBACK};font-size:16px;border:none;">${opts.buttonText}</a></td></tr></table>` : ''}
    </div>`
    : hasButton
      ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 0;">
      <tr><td>
        <a href="${opts.buttonUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff !important;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-family:${FONT_FALLBACK};font-size:16px;border:none;">${opts.buttonText}</a>
      </td></tr>
    </table>`
      : '';

  const secondaryHtml = opts.secondaryLink
    ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;font-family:${FONT_FALLBACK};">${shell.notConvincedPrefix} <a href="${opts.secondaryLink.url}" style="color:#2563eb;text-decoration:none;">${opts.secondaryLink.text}</a></p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="${shell.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:${FONT_FALLBACK};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
        <tr>
          <td style="background-color:#2563eb;border-radius:16px 16px 0 0;padding:28px 24px;text-align:center;">
            <img src="${logoImgUrl}" alt="${t('common.logoAlt')}" width="200" height="48" style="display:block;height:48px;width:auto;max-width:200px;margin:0 auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:36px 28px;border-radius:0 0 16px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 16px;line-height:1.3;font-family:${FONT_FALLBACK};">${opts.title}</h1>
            ${opts.content}
            ${ctaBlock}
            ${secondaryHtml}
            <p style="margin:24px 0 0;font-size:13px;color:#64748b;font-family:${FONT_FALLBACK};">${shell.teamSignoff}</p>
            ${opts.supportUrl ? `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;"><a href="${opts.supportUrl}" style="color:#2563eb;text-decoration:none;">${shell.supportHelp}</a></p>` : ''}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * @deprecated Utiliser renderZenithEmail pour la cohérence. Conservé pour rétrocompatibilité.
 */
export function EmailLayout(params: {
  title: string;
  bodyHtml: string;
  ctaUrl: string;
  ctaLabel: string;
  locale?: string;
}): string {
  return renderZenithEmail(
    params.title,
    params.bodyHtml,
    params.ctaLabel,
    params.ctaUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getWelcomeEmailHtml(params: { establishmentName: string; loginUrl: string; locale?: string }) {
  const t = te(params.locale);
  const est = params.establishmentName ? ` ${params.establishmentName}` : '';
  const content = `
    <p style="margin: 0 0 16px;">${t('welcomeLegacy.greeting', { establishment: est })}</p>
    <p style="margin: 0 0 24px;">${t('welcomeLegacy.trialIntro')}</p>
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 12px;">${t('welcomeLegacy.guideTitle')}</h2>
      <ol style="margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">${t.raw('welcomeLegacy.step1')}</li>
        <li style="margin-bottom: 8px;">${t('welcomeLegacy.step2')}</li>
        <li style="margin-bottom: 8px;">${t('welcomeLegacy.step3')}</li>
        <li style="margin-bottom: 8px;">${t('welcomeLegacy.step4')}</li>
      </ol>
    </div>
    <p style="margin: 0 0 24px;">${t('welcomeLegacy.footer')}</p>
  `.trim();
  return renderZenithEmail(
    t('welcomeLegacy.title'),
    content,
    t('common.accessDashboard'),
    params.loginUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getWelcomeEliteEmailHtml(params: { firstName: string; whatsappSettingsUrl: string; locale?: string }) {
  const t = te(params.locale);
  const prenom = params.firstName || '';
  const firstNamePart = prenom ? t('welcomeElite.line1NamePart', { firstName: prenom }) : '';
  const content = `
    <p style="margin: 0 0 16px;">${t('welcomeElite.line1', { firstNamePart })}</p>
    <p style="margin: 0 0 24px; font-weight: 600; color: #0f172a;">${t('welcomeElite.line2')}</p>
    <p style="margin: 0 0 24px;">${t('welcomeElite.line3')}</p>
  `.trim();
  const title = prenom ? t('welcomeElite.titleWithName', { firstName: prenom }) : t('welcomeElite.titleNoName');
  return renderZenithEmail(
    title,
    content,
    t('welcomeElite.ctaWhatsApp'),
    params.whatsappSettingsUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getTrialGiftEmailHtml(params: { loginUrl: string; locale?: string }) {
  const t = te(params.locale);
  const content = `
    <p style="margin: 0 0 16px;">${t.raw('trialGift.intro')}</p>
    <p style="margin: 0 0 24px;">${t('trialGift.powersTitle')}</p>
    <ul style="margin: 0 0 24px; padding-left: 20px;">
      <li style="margin-bottom: 8px;">${t.raw('trialGift.li1')}</li>
      <li style="margin-bottom: 8px;">${t.raw('trialGift.li2')}</li>
      <li style="margin-bottom: 8px;">${t.raw('trialGift.li3')}</li>
    </ul>
    <p style="margin: 0 0 24px; font-weight: 600; color: #2563eb;">${t('trialGift.highlight')}</p>
  `.trim();
  return renderZenithEmail(
    t('trialGift.title'),
    content,
    t('common.accessDashboard'),
    params.loginUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getTrialEndProtectionEmailHtml(params: {
  firstName: string;
  bilanText: string;
  checkoutUrl: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const prenom = params.firstName || '';
  const fn = prenom ? ` ${prenom}` : '';
  const content = `
    <p style="margin: 0 0 16px;">${t('trialEndProtection.greeting', { firstName: fn })}</p>
    <p style="margin: 0 0 24px;">${t.raw('trialEndProtection.body1')}</p>
    <p style="margin: 0 0 24px;">${t('trialEndProtection.body2')}</p>
  `.trim();
  return renderZenithEmail(
    t('trialEndProtection.title'),
    content,
    t('trialEndProtection.cta'),
    params.checkoutUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export type TrialReminderPlanSlug = 'vision' | 'pulse' | 'zenith';

export function getTrialEndingSoonEmailHtml(params: {
  firstName: string;
  daysLeft: number;
  dashboardBillingUrl: string;
  trialEndDate: string;
  planName: string;
  planPrice: string;
  currentPlanSlug?: TrialReminderPlanSlug;
  locale?: string;
}) {
  const t = te(params.locale);
  const prenom = params.firstName || '';
  const fn = prenom ? ` ${prenom}` : '';
  const chosenPulseOrVision = params.currentPlanSlug === 'pulse' || params.currentPlanSlug === 'vision';
  const chosenPlanLabel = params.currentPlanSlug === 'pulse' ? 'PULSE' : params.currentPlanSlug === 'vision' ? 'VISION' : null;

  const daysKey = params.daysLeft > 1 ? 'trialEndingSoon.days' : 'trialEndingSoon.day';
  const daysLabel = `${params.daysLeft} ${t(daysKey)}`;

  const introBlock =
    chosenPulseOrVision && chosenPlanLabel
      ? `<p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t('trialEndingSoon.introChosen', { firstName: fn })}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t('trialEndingSoon.introChosen2', { planLabel: chosenPlanLabel })}</p>`
      : `<p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t('trialEndingSoon.introZenith', { firstName: fn })}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t('trialEndingSoon.introZenith2', { days: daysLabel })}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t.raw('trialEndingSoon.introZenith3')}</p>`;

  const chargeSentence = `<p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">${t('trialEndingSoon.charge', {
    planName: params.planName,
    trialEndDate: params.trialEndDate,
    planPrice: params.planPrice,
  })}</p>`;

  const sentenceAboveButton = chosenPulseOrVision
    ? `<p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">${t('trialEndingSoon.aboveBtnChosen')}</p>`
    : `<p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">${t.raw('trialEndingSoon.aboveBtnZenith')}</p>`;

  const content = `
    ${introBlock}
    ${chargeSentence}
    ${sentenceAboveButton}
  `.trim();

  return renderZenithEmail(
    t('trialEndingSoon.title'),
    content,
    t('trialEndingSoon.cta'),
    params.dashboardBillingUrl,
    undefined,
    supportUrlForLocale(params.locale),
    { text: t('trialEndingSoon.secondaryCancel'), url: params.dashboardBillingUrl },
    undefined,
    params.locale
  );
}

export function getUrgencyEmailHtml(params: {
  establishmentName: string;
  daysLeft: number;
  checkoutUrl: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const est = params.establishmentName ? ` ${params.establishmentName}` : '';
  const daysKey = params.daysLeft > 1 ? 'urgency.days' : 'urgency.day';
  const daysLabel = `${params.daysLeft} ${t(daysKey)}`;
  const content = `
    <p style="margin: 0 0 16px;">${t('urgency.greeting', { establishment: est })}</p>
    <p style="margin: 0 0 24px;">${t('urgency.body', { days: daysLabel })}</p>
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <p style="margin: 0 0 8px; font-size: 14px;">${t.raw('urgency.promoTitle')}</p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: 0.05em;">${t('urgency.promoCode')}</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #64748b;">${t('urgency.promoHint')}</p>
    </div>
  `.trim();
  return renderZenithEmail(
    t('urgency.title'),
    content,
    t('urgency.cta'),
    params.checkoutUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getWelcomeTrial14EmailHtml(params: {
  establishmentName: string;
  planName: string;
  loginUrl: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const est = params.establishmentName ? ` ${params.establishmentName}` : '';
  const content = `
    <p style="margin: 0 0 16px;">${t('welcomeTrial14.greeting', { establishment: est })}</p>
    <p style="margin: 0 0 24px;">${t('welcomeTrial14.body1', { planName: params.planName })}</p>
    <p style="margin: 0 0 24px;">${t('welcomeTrial14.body2')}</p>
  `.trim();
  return renderZenithEmail(
    t('welcomeTrial14.title'),
    content,
    t('common.accessDashboard'),
    params.loginUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getWelcomePaidHtml(params: {
  planName: string;
  establishmentName: string;
  loginUrl: string;
  supportUrl?: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const plan = (params.planName || '').toLowerCase();
  let benefitsHtml = '';
  if (plan.includes('zenith')) {
    benefitsHtml = `
      <ul style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.7;">
        <li style="margin-bottom: 8px;">${t.raw('welcomePaid.zenithLi1')}</li>
        <li style="margin-bottom: 8px;">${t.raw('welcomePaid.zenithLi2')}</li>
        <li style="margin-bottom: 8px;">${t.raw('welcomePaid.zenithLi3')}</li>
      </ul>`;
  } else if (plan.includes('pulse')) {
    benefitsHtml = `
      <ul style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.7;">
        <li style="margin-bottom: 8px;">${t.raw('welcomePaid.pulseLi1')}</li>
        <li style="margin-bottom: 8px;">${t.raw('welcomePaid.pulseLi2')}</li>
        <li style="margin-bottom: 8px;">${t.raw('welcomePaid.pulseLi3')}</li>
      </ul>`;
  } else {
    benefitsHtml = `
      <ul style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.7;">
        <li style="margin-bottom: 8px;">${t.raw('welcomePaid.visionLi1')}</li>
        <li style="margin-bottom: 8px;">${t.raw('welcomePaid.visionLi2')}</li>
        <li style="margin-bottom: 8px;">${t.raw('welcomePaid.visionLi3')}</li>
      </ul>`;
  }
  const est = params.establishmentName ? ` ${params.establishmentName}` : '';
  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t('welcomePaid.greeting', { establishment: est })}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t('welcomePaid.thanks', { planName: params.planName })}</p>
    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #0f172a;">${t('welcomePaid.benefitsTitle')}</p>
    ${benefitsHtml}
    <p style="margin: 0 0 24px; font-size: 13px; color: #64748b;">${t('welcomePaid.invoiceNote')}</p>
  `.trim();
  const supportUrl = params.supportUrl ?? supportUrlForLocale(params.locale);
  return renderZenithEmail(
    t('welcomePaid.title', { planName: params.planName }),
    content,
    t('common.accessDashboard'),
    params.loginUrl,
    undefined,
    supportUrl,
    undefined,
    undefined,
    params.locale
  );
}

export function getWelcomeZenithTrialHtml(params: {
  loginUrl: string;
  settingsUrl?: string;
  supportUrl?: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const loc = normalizeEmailLocale(params.locale);
  const formattedEnd = trialEndDate.toLocaleDateString(siteLocaleToIntlDateTag(loc), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const settingsUrl = params.settingsUrl ?? `${logoBase().replace(/\/$/, '')}/${loc}/dashboard/settings`;

  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t('welcomeZenithTrial.intro')}</p>
    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #0f172a;">${t('welcomeZenithTrial.missionsTitle')}</p>
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
        <li style="margin-bottom: 8px;">${t.raw('welcomeZenithTrial.li1')}</li>
        <li style="margin-bottom: 8px;">${t.raw('welcomeZenithTrial.li2')}</li>
        <li style="margin-bottom: 8px;">${t.raw('welcomeZenithTrial.li3')}</li>
      </ol>
    </div>
    <p style="margin: 0 0 24px; font-size: 13px; color: #64748b; line-height: 1.5; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
      ${t('welcomeZenithTrial.trialEnd', { date: formattedEnd, settingsUrl })}
    </p>
  `.trim();
  const supportUrl = params.supportUrl ?? supportUrlForLocale(params.locale);
  return renderZenithEmail(
    t('welcomeZenithTrial.title'),
    content,
    t('common.accessDashboard'),
    params.loginUrl,
    undefined,
    supportUrl,
    undefined,
    undefined,
    params.locale
  );
}

export function getZenithTrialWelcomeEmailHtml(params: {
  customerName: string;
  trialEndDate: string;
  dashboardUrl: string;
  settingsUrl?: string;
  locale?: string;
}): string {
  const t = te(params.locale);
  const { customerName, trialEndDate, dashboardUrl } = params;
  const loc = normalizeEmailLocale(params.locale);
  const settingsUrl = params.settingsUrl ?? `${logoBase().replace(/\/$/, '')}/${loc}/dashboard/settings`;
  const logoImgUrl = `${logoBase()}/logo-hd.png`;
  const displayName = customerName?.trim() || t('common.you');

  return `
<!DOCTYPE html>
<html lang="${t('zenithTrialDark.htmlLang')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:${FONT_FALLBACK};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
        <tr>
          <td style="background:#1e293b;border-radius:20px 20px 0 0;padding:32px 28px;text-align:center;border:1px solid rgba(148,163,184,0.2);border-bottom:none;">
            <img src="${logoImgUrl}" alt="${t('common.logoAlt')}" width="200" height="48" style="display:block;height:48px;width:auto;max-width:200px;margin:0 auto;border:0;outline:none;text-decoration:none;" />
            <p style="margin:20px 0 0;font-size:14px;font-weight:600;color:#c4b5fd;letter-spacing:0.08em;text-transform:uppercase;">${t('zenithTrialDark.badge')}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#1e293b;padding:36px 28px;border-radius:0 0 20px 20px;border:1px solid rgba(148,163,184,0.2);border-top:none;">
            <h1 style="font-size:24px;font-weight:700;color:#f8fafc;margin:0 0 20px;line-height:1.3;font-family:${FONT_FALLBACK};">${t('zenithTrialDark.h1')}</h1>
            <p style="margin:0 0 24px;font-size:16px;color:#cbd5e1;line-height:1.6;">${t('zenithTrialDark.intro', { displayName })}</p>

            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#e2e8f0;letter-spacing:0.02em;">${t('zenithTrialDark.missionsHeading')}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
              <tr><td style="padding:16px 20px;background:rgba(99,102,241,0.15);border-radius:12px;border-left:4px solid #8b5cf6;margin-bottom:12px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#a78bfa;">${t('zenithTrialDark.m1Title')}</p>
                <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.5;">${t('zenithTrialDark.m1Body')}</p>
              </td></tr>
              <tr><td style="padding:12px 0 0 0;height:8px;"></td></tr>
              <tr><td style="padding:16px 20px;background:rgba(99,102,241,0.15);border-radius:12px;border-left:4px solid #8b5cf6;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#a78bfa;">${t('zenithTrialDark.m2Title')}</p>
                <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.5;">${t('zenithTrialDark.m2Body')}</p>
              </td></tr>
              <tr><td style="padding:12px 0 0 0;height:8px;"></td></tr>
              <tr><td style="padding:16px 20px;background:rgba(99,102,241,0.15);border-radius:12px;border-left:4px solid #8b5cf6;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#a78bfa;">${t('zenithTrialDark.m3Title')}</p>
                <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.5;">${t('zenithTrialDark.m3Body')}</p>
              </td></tr>
            </table>

            <div style="background:rgba(148,163,184,0.1);border-radius:12px;padding:20px;margin-bottom:28px;border:1px solid rgba(148,163,184,0.2);">
              <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">${t('zenithTrialDark.trialBox', { trialEndDate, settingsUrl })}</p>
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
              <tr><td>
                <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#d97706 0%,#b45309 100%);color:#ffffff !important;padding:16px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-family:${FONT_FALLBACK};font-size:16px;box-shadow:0 4px 14px rgba(217,119,6,0.4);">${t('common.accessDashboardZenith')}</a>
              </td></tr>
            </table>

            <p style="margin:28px 0 0;font-size:13px;color:#64748b;">${buildZenithShellCopy(loc).teamSignoff}</p>
            <p style="margin:8px 0 0;font-size:12px;"><a href="${supportUrlForLocale(params.locale)}" style="color:#94a3b8;text-decoration:none;">${buildZenithShellCopy(loc).supportHelp}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export type ReputexaOnboardingEmailData = {
  customerName: string;
  planName: string;
  planSlug: 'vision' | 'pulse' | 'zenith';
  trialEndDate: string | null;
  invoiceUrl: string | null;
  interval: 'month' | 'year';
  isTrial: boolean;
  dashboardUrl: string;
  settingsUrl: string;
  unsubscribeUrl?: string;
  locale?: string;
};

export function getReputexaOnboardingEmailHtml(data: ReputexaOnboardingEmailData): string {
  const t = te(data.locale);
  const {
    customerName,
    planSlug,
    trialEndDate,
    invoiceUrl,
    interval,
    isTrial,
    dashboardUrl,
    settingsUrl,
  } = data;
  const displayName = customerName?.trim() || t('common.you');

  const isPulse = planSlug === 'pulse';
  const isVision = planSlug === 'vision';

  let headline = '';
  let intro = '';
  let missionsHtml = '';

  if (isVision) {
    headline = t('onboarding.visionHeadline');
    intro = t('onboarding.visionIntro', { displayName });
    missionsHtml = `
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #64748b;">
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
        <li style="margin-bottom: 8px;">${t.raw('onboarding.visionLi1')}</li>
      </ol>
    </div>`;
  } else if (isPulse) {
    headline = t('onboarding.pulseHeadline');
    intro = t('onboarding.pulseIntro', { displayName });
    missionsHtml = `
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
        <li style="margin-bottom: 8px;">${t.raw('onboarding.pulseLi1')}</li>
        <li style="margin-bottom: 8px;">${t.raw('onboarding.pulseLi2')}</li>
      </ol>
    </div>`;
  } else {
    headline = t('onboarding.zenithHeadline');
    intro = t('onboarding.zenithIntro', { displayName });
    missionsHtml = `
    <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
        <li style="margin-bottom: 8px;">${t.raw('onboarding.zenithLi1')}</li>
        <li style="margin-bottom: 8px;">${t.raw('onboarding.zenithLi2')}</li>
        <li style="margin-bottom: 8px;">${t.raw('onboarding.zenithLi3')}</li>
      </ol>
    </div>`;
  }

  const yearMessage =
    interval === 'year' ? `<p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">${t('onboarding.yearThanks')}</p>` : '';

  const trialBlock =
    isTrial && trialEndDate
      ? `<div style="margin: 0 0 16px; padding: 16px 20px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f0fdf4; border-left: 4px solid #22c55e;">
    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #166534;">${t('onboarding.trialGiftTitle')}</p>
    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.6;">${t('onboarding.trialGiftBody', { settingsUrl })}</p>
    </div>
    <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; line-height: 1.5;">${t('onboarding.trialEndsLine', { trialEndDate })}</p>
    <p style="margin: 0 0 24px; font-size: 13px; color: #64748b;">${t('onboarding.trialCancelLink', { settingsUrl })}</p>`
      : '';

  const invoiceBlock = invoiceUrl ? `<p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">${t('onboarding.invoiceLink', { invoiceUrl })}</p>` : '';

  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${intro}</p>
    ${yearMessage}
    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #0f172a;">${t('onboarding.nextStepsTitle')}</p>
    ${missionsHtml}
    ${trialBlock}
    ${invoiceBlock}
  `.trim();

  return renderZenithEmail(
    headline,
    content,
    t('common.accessDashboard'),
    dashboardUrl,
    undefined,
    supportUrlForLocale(data.locale),
    undefined,
    undefined,
    data.locale
  );
}

export function getMonthlyInvoiceEmailHtml(data: { monthYear: string; invoiceUrl: string; locale?: string }) {
  const t = te(data.locale);
  const content = `<p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">${t('monthlyInvoice.body')}</p>`.trim();
  return renderZenithEmail(
    t('monthlyInvoice.title', { monthYear: data.monthYear }),
    content,
    t('monthlyInvoice.cta'),
    data.invoiceUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    data.locale
  );
}

export function getPaymentFailedEmailHtml(data: { portalUrl: string; dashboardBillingUrl: string; locale?: string }): string {
  const t = te(data.locale);
  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t('paymentFailed.body1')}</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.6;">${t('paymentFailed.body2')}</p>
  `.trim();
  return renderZenithEmail(
    t('paymentFailed.title'),
    content,
    t('paymentFailed.ctaPortal'),
    data.portalUrl,
    undefined,
    undefined,
    { text: t('paymentFailed.secondaryBilling'), url: data.dashboardBillingUrl },
    undefined,
    data.locale
  );
}

export function getPaymentActionRequiredEmailHtml(data: { invoiceUrl: string; locale?: string }): string {
  const t = te(data.locale);
  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${t('paymentActionRequired.body1')}</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.6;">${t('paymentActionRequired.body2')}</p>
  `.trim();
  return renderZenithEmail(
    t('paymentActionRequired.title'),
    content,
    t('paymentActionRequired.cta'),
    data.invoiceUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    data.locale
  );
}

function planSelectionPack(
  locale: string | undefined,
  t: ReturnType<typeof getEmailTemplatesTranslator>
): string {
  const loc = normalizeEmailLocale(locale);
  const th = t as { has: (k: string) => boolean };
  if (th.has(`planSelection.${loc}.hello`)) return loc;
  if (th.has('planSelection.en.hello')) return 'en';
  return 'fr';
}

export function getPlanSelectionConfirmationEmailHtml(data: {
  planName: string;
  planPrice: string;
  trialEndDate: string;
  locale?: string;
}) {
  const { planName, planPrice, trialEndDate, locale = 'fr' } = data;
  const t = te(locale);
  const pack = planSelectionPack(locale, t);
  const tp = (sub: string, vars?: Record<string, string>) =>
    (t as (k: string, v?: Record<string, string>) => string)(`planSelection.${pack}.${sub}`, vars);

  const isZenithFuturePlan = planName.toLowerCase().includes('zenith');
  const lossNote =
    !isZenithFuturePlan
      ? `<p style="margin: 8px 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">${tp('lossNote', { planName })}</p>`
      : '';

  const content = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${tp('hello')}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${tp('confirm', { planName })}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${tp('noChange', { trialEndDate })}</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">${tp('charge', { planPrice })}</p>
    ${lossNote}
    <p style="margin: 8px 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">${tp('closing')}</p>
  `.trim();
  const base = (logoBase() || '').replace(/\/$/, '');
  const dashboardPath = (SITE_LOCALE_CODES as readonly string[]).includes(normalizeEmailLocale(locale))
    ? normalizeEmailLocale(locale)
    : 'fr';
  return renderZenithEmail(
    tp('title'),
    content,
    tp('cta'),
    `${base}/${dashboardPath}/dashboard`,
    undefined,
    supportUrlForLocale(locale),
    undefined,
    undefined,
    locale
  );
}

export function getTrialReminder3DaysHtml(params: {
  firstName: string;
  planName: string;
  reviewsRepliedCount: number;
  checkoutUrl: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const prenom = params.firstName || t('trialReminder3Days.greetingFallback');
  const benefits =
    params.reviewsRepliedCount > 0
      ? t('trialReminder3Days.benefitsWithCount', { count: String(params.reviewsRepliedCount) })
      : t('trialReminder3Days.benefitsDefault');
  const content = `
    <p style="margin: 0 0 16px;">${t('trialReminder3Days.body1', { firstName: prenom })}</p>
    <p style="margin: 0 0 24px;">${benefits}</p>
    <p style="margin: 0 0 24px;">${t.raw('trialReminder3Days.body2')}</p>
  `.trim();
  return renderZenithEmail(
    t('trialReminder3Days.title'),
    content,
    t('trialReminder3Days.cta', { planName: params.planName }),
    params.checkoutUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getMagicLinkEmailHtml(params: {
  actionUrl: string;
  locale?: string;
  /** Premier prénom depuis le profil (optionnel). */
  firstName?: string | null;
}) {
  const t = te(params.locale);
  const fn = (params.firstName ?? '').trim();
  const body1 = fn ? t('magicLink.body1Personal', { firstName: fn }) : t('magicLink.body1Generic');
  const content = `
    <p style="margin: 0 0 16px;">${body1}</p>
    <p style="margin: 0 0 16px;">${t.raw('magicLink.body2')}</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">${t('magicLink.body3')}</p>
  `.trim();
  return renderZenithEmail(
    t('magicLink.title'),
    content,
    t('magicLink.cta'),
    params.actionUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getBananoPinResetEmailHtml(resetUrl: string, locale?: string): string {
  const t = te(locale);
  const content = `
    <p style="margin: 0 0 16px;">${t.raw('bananoPinReset.body1')}</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">${t('bananoPinReset.body2')}</p>
  `.trim();
  return renderZenithEmail(
    t('bananoPinReset.title'),
    content,
    t('bananoPinReset.cta'),
    resetUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    locale
  );
}

export function getAuthEmailHtml(link: string, locale?: string): string {
  const t = te(locale);
  const content = `
    <p style="margin: 0 0 16px;">${t('authEmailChange.body1')}</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">${t('authEmailChange.body2')}</p>
  `.trim();
  return renderZenithEmail(
    t('authEmailChange.title'),
    content,
    t('authEmailChange.cta'),
    link,
    undefined,
    undefined,
    undefined,
    undefined,
    locale
  );
}

export function getVerifyEmailHtml(params: {
  confirmUrl?: string;
  otpCode?: string;
  email?: string;
  locale?: string;
  firstName?: string | null;
}) {
  const t = te(params.locale);
  const fn = (params.firstName ?? '').trim();
  const otpIntro = fn ? t('verifyEmail.otpIntroNamed', { firstName: fn }) : t('verifyEmail.otpIntroGeneric');
  const linkIntro = fn ? t('verifyEmail.linkIntroNamed', { firstName: fn }) : t('verifyEmail.linkIntroGeneric');
  const content = params.otpCode
    ? `
    <p style="margin: 0 0 16px;">${otpIntro}</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">${t('verifyEmail.otpHint')}</p>
  `.trim()
    : `
    <p style="margin: 0 0 16px;">${linkIntro}</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">${t('verifyEmail.linkHint')}</p>
  `.trim();
  return renderZenithEmail(
    t('verifyEmail.title'),
    content,
    params.otpCode ? '' : params.confirmUrl ? t('verifyEmail.ctaConfirm') : '',
    params.otpCode ? '' : params.confirmUrl || '#',
    params.otpCode,
    undefined,
    undefined,
    params.email,
    params.locale
  );
}

export type GroupComparisonItem = {
  name: string;
  avgRating: number;
  totalReviews: number;
};

export function getMonthlyReportEmailHtml(params: {
  establishmentName: string;
  monthLabel: string;
  hook: string;
  teaser: string;
  dashboardUrl: string;
  groupComparison?: GroupComparisonItem[];
  locale?: string;
}) {
  const t = te(params.locale);
  const comparisonBlock =
    params.groupComparison && params.groupComparison.length > 1
      ? `
    <div style="background: #f1f5f9; border-radius: 12px; padding: 16px 20px; margin: 24px 0;">
      <h3 style="font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">${t('monthlyReport.comparisonTitle')}</h3>
      <table role="presentation" style="width:100%; border-collapse: collapse;">
        ${params.groupComparison
          .sort((a, b) => b.avgRating - a.avgRating)
          .map(
            (e, i) =>
              `<tr>
                <td style="padding: 6px 0; font-size: 13px; color: #475569;">${i === 0 ? t('monthlyReport.trophy') : ''}${e.name}</td>
                <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${e.avgRating.toFixed(1)}${t('monthlyReport.ratingSuffix')}</td>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; text-align: right;">${e.totalReviews}${t('monthlyReport.reviewsSuffix')}</td>
              </tr>`
          )
          .join('')}
      </table>
    </div>`
      : '';

  const est = params.establishmentName ? ` ${params.establishmentName}` : '';
  const content = `
    <p style="margin: 0 0 16px;">${t('monthlyReport.greeting', { establishment: est })}</p>
    <p style="margin: 0 0 16px; font-weight: 600; color: #0f172a;">${params.hook}</p>
    <p style="margin: 0 0 24px;">${params.teaser}</p>
    ${comparisonBlock}
    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">${t('monthlyReport.footer', { monthLabel: params.monthLabel })}</p>
  `.trim();
  return renderZenithEmail(
    t('monthlyReport.title', { monthLabel: params.monthLabel }),
    content,
    t('monthlyReport.cta'),
    params.dashboardUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getEstablishmentAddedEmailHtml(params: {
  establishmentName: string;
  totalNextMonth: number;
  dashboardUrl: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const content = `
    <p style="margin: 0 0 16px;">${t('establishmentAdded.body1', { name: params.establishmentName })}</p>
    <p style="margin: 0 0 24px;">${t('establishmentAdded.body2', { amount: String(params.totalNextMonth) })}</p>
  `.trim();
  return renderZenithEmail(
    t('establishmentAdded.title'),
    content,
    t('establishmentAdded.cta'),
    params.dashboardUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getEstablishmentDeletedEmailHtml(params: {
  establishmentName: string;
  totalNextMonth: number;
  dashboardUrl: string;
  accessValidUntil?: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const loc = normalizeEmailLocale(params.locale);
  const totalFormatted = new Intl.NumberFormat(siteLocaleToIntlDateTag(loc), {
    style: 'currency',
    currency: 'EUR',
  }).format(params.totalNextMonth);
  const dateBlock = params.accessValidUntil
    ? `
    <tr>
      <td style="padding: 8px 0; font-size: 13px; color: #64748b;">${t('establishmentDeleted.effectiveFrom')}</td>
      <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${params.accessValidUntil}</td>
    </tr>`
    : '';

  const content = `
    <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.6;">${t('establishmentDeleted.body1', { name: params.establishmentName })}</p>

    <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #64748b;">${t('establishmentDeleted.labelNewMonthly')}</td>
          <td style="padding: 8px 0; font-size: 18px; font-weight: 700; color: #2563eb; text-align: right;">${totalFormatted}<span style="font-size: 13px; font-weight: 500; color: #64748b;">${t('establishmentDeleted.perMonth')}</span></td>
        </tr>
        ${dateBlock}
      </table>
    </div>

    <p style="margin: 0 0 24px; font-size: 14px; color: #64748b; line-height: 1.5;">${t('establishmentDeleted.footer')}</p>
  `.trim();
  return renderZenithEmail(
    t('establishmentDeleted.title'),
    content,
    t('establishmentDeleted.cta'),
    params.dashboardUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getUpgradeConfirmationEmailHtml(params: {
  planName: string;
  establishmentName: string;
  dashboardUrl: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const est = params.establishmentName ? ` ${params.establishmentName}` : '';
  const content = `
    <p style="margin: 0 0 16px;">${t('upgradeConfirmation.greeting', { establishment: est })}</p>
    <p style="margin: 0 0 24px;">${t('upgradeConfirmation.body1', { planName: params.planName })}</p>
    <p style="margin: 0 0 24px;">${t('upgradeConfirmation.body2')}</p>
  `.trim();
  return renderZenithEmail(
    t('upgradeConfirmation.title'),
    content,
    t('upgradeConfirmation.cta'),
    params.dashboardUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getDowngradeConfirmationEmailHtml(params: { quantity: number; dashboardUrl: string; locale?: string }) {
  const t = te(params.locale);
  const content = `
    <p style="margin: 0 0 16px;">${t('downgradeConfirmation.body1')}</p>
    <p style="margin: 0 0 24px;">${t('downgradeConfirmation.body2', { quantity: String(params.quantity) })}</p>
    <p style="margin: 0 0 24px;">${t('downgradeConfirmation.body3')}</p>
  `.trim();
  return renderZenithEmail(
    t('downgradeConfirmation.title'),
    content,
    t('downgradeConfirmation.cta'),
    params.dashboardUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

export function getExpirationEmailHtml(params: {
  establishmentName: string;
  planName: string;
  checkoutUrl: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const est = params.establishmentName ? ` ${params.establishmentName}` : '';
  const content = `
    <p style="margin: 0 0 16px;">${t('expiration.greeting', { establishment: est })}</p>
    <p style="margin: 0 0 24px;">${t('expiration.body')}</p>
  `.trim();
  return renderZenithEmail(
    t('expiration.title'),
    content,
    t('expiration.cta', { planName: params.planName }),
    params.checkoutUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}

function legalDocLabel(locale: string | undefined, type: string): string {
  const t = te(locale);
  const key = `legalDocTypes.${type}`;
  if ((t as { has: (k: string) => boolean }).has(key)) {
    return (t as (k: string) => string)(key);
  }
  return type;
}

export function getLegalUpdateEmailHtml(params: {
  recipientName?: string;
  documentTypes: string[];
  summaryOfChanges: string;
  effectiveDate: string;
  legalPageUrl: string;
  locale?: string;
}) {
  const t = te(params.locale);
  const greeting = params.recipientName
    ? `<p style="margin: 0 0 16px; font-size: 15px; color: #374151;">${t('legalUpdate.greetingNamed', { name: params.recipientName })}</p>`
    : `<p style="margin: 0 0 16px; font-size: 15px; color: #374151;">${t('legalUpdate.greetingGeneric')}</p>`;

  const docList = params.documentTypes
    .map((dt) => legalDocLabel(params.locale, dt))
    .map(
      (label) =>
        `<li style="margin-bottom: 6px; color: #1e293b; font-size: 14px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2563eb;margin-right:8px;vertical-align:middle;"></span>
          ${label}
        </li>`
    )
    .join('');

  const content = `
    ${greeting}
    <p style="margin: 0 0 20px; font-size: 15px; color: #374151; line-height: 1.6;">
      ${t('legalUpdate.intro', { effectiveDate: params.effectiveDate })}
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
      <p style="margin: 0 0 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">
        ${t('legalUpdate.updatedDocsTitle')}
      </p>
      <ul style="margin: 0; padding: 0; list-style: none;">
        ${docList}
      </ul>
    </div>

    <div style="background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1d4ed8;">
        ${t('legalUpdate.summaryTitle')}
      </p>
      <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.6;">
        ${params.summaryOfChanges}
      </p>
    </div>

    <p style="margin: 0 0 8px; font-size: 14px; color: #374151; line-height: 1.6;">
      ${t('legalUpdate.acceptNote', { effectiveDate: params.effectiveDate })}
    </p>
    <p style="margin: 0 0 24px; font-size: 13px; color: #64748b; line-height: 1.6;">
      ${t('legalUpdate.questionsNote')}
    </p>
  `.trim();

  return renderZenithEmail(
    t('legalUpdate.title'),
    content,
    t('legalUpdate.cta'),
    params.legalPageUrl,
    undefined,
    undefined,
    undefined,
    undefined,
    params.locale
  );
}
