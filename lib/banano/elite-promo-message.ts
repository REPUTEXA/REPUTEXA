import { createTranslator } from 'next-intl';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { parisCalendarMonthKeys } from '@/lib/banano/elite-paris-month';

export type ElitePromoMessageInput = {
  locale: string | null | undefined;
  establishmentName: string;
  memberFirstName: string | null;
  memberDisplayName: string;
  monthKey: string;
  /** Free text from the merchant (promo details). */
  offerText: string;
};

export function formatEliteMonthLabel(monthKey: string, locale: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return monthKey;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = new Date(Date.UTC(y, mo - 1, 15, 12, 0, 0, 0));
  const loc = normalizeAppLocale(locale ?? undefined);
  try {
    return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  } catch {
    return monthKey;
  }
}

/**
 * Builds the full WhatsApp body for an Elite promo (merchant dashboard language).
 */
export function buildElitePromoWhatsAppBody(input: ElitePromoMessageInput): string {
  const loc = normalizeAppLocale(input.locale ?? undefined);
  const messages = getServerMessagesForLocale(loc);
  const t = createTranslator({ locale: loc, messages, namespace: 'Dashboard' });
  const first =
    (input.memberFirstName ?? '').trim() ||
    input.memberDisplayName.trim().split(/\s+/)[0] ||
    t('bananoEliteClients.fallbackFirstName');
  const commerce = input.establishmentName.trim() || t('bananoEliteClients.fallbackEstablishment');
  const monthLabel = formatEliteMonthLabel(input.monthKey, input.locale);
  const { previousMonthKey } = parisCalendarMonthKeys();
  const isLastCompletedParisMonth = input.monthKey.trim() === previousMonthKey;
  const monthContext = isLastCompletedParisMonth
    ? t('bananoEliteClients.promoMonthContextLast', { monthLabel })
    : t('bananoEliteClients.promoMonthContextDefault', { monthLabel });
  return t('bananoEliteClients.promoWhatsAppBody', {
    establishmentName: commerce,
    firstName: first,
    monthContext,
    offerText: input.offerText.trim(),
  });
}
