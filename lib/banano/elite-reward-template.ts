/** Remplace les variables `{name}` dans le gabarit WhatsApp Elite Top Clients. */
export function applyEliteRewardWhatsAppTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

const INTL_BY_APP: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  'en-gb': 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

function intlTagForAppLocale(locale: string | null | undefined): string {
  const raw = String(locale ?? '').trim().toLowerCase();
  return INTL_BY_APP[raw] ?? 'fr-FR';
}

/** Affiche un montant € pour le message (ex. 5,00 €). */
export function formatEliteRewardAmountEuros(
  euroCents: number,
  appLocale: string | null | undefined
): string {
  const cents = Math.max(0, Math.floor(euroCents));
  const tag = intlTagForAppLocale(appLocale);
  const euroFloat = cents / 100;
  const minFrac = cents % 100 === 0 ? 0 : 2;
  const n = new Intl.NumberFormat(tag, {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: 2,
  }).format(euroFloat);
  return `${n} €`;
}
