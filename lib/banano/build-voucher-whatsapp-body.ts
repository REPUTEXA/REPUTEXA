import 'server-only';

import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

export function buildVoucherIssuedWhatsAppBody(params: {
  commerceName: string;
  codes: string[];
  rewardLine: string;
  threshold: number;
  /** Reliquat après émission (points ou tampons selon `issuerUnit`). */
  pointsBalanceAfter: number;
  expiresAtIso: string | null;
  issuerUnit?: 'points' | 'stamps';
  /** Locale marchand (`profiles.language`). */
  locale: string;
}): string {
  const t = createServerTranslator('Loyalty.whatsappVoucher', params.locale);
  const tag = siteLocaleToIntlDateTag(params.locale);
  const codesLine = params.codes.join(', ');
  const unit = params.issuerUnit === 'stamps' ? 'stamps' : 'points';

  let exp = '';
  if (params.expiresAtIso) {
    try {
      const date = new Intl.DateTimeFormat(tag, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(params.expiresAtIso));
      exp = `\n${t('expiryLine', { date })}`;
    } catch {
      exp = '';
    }
  }

  const balanceLine =
    unit === 'stamps'
      ? t('balanceStamps', { count: params.pointsBalanceAfter })
      : t('balancePoints', { count: params.pointsBalanceAfter });

  const thresholdLine =
    unit === 'stamps'
      ? t('thresholdStamps', { threshold: params.threshold })
      : t('thresholdPoints', { threshold: params.threshold });

  const next = `\n${t('nextSep')}\n${t('nextLead', { balanceLine, thresholdLine })}`;

  return [
    t('header', { commerceName: params.commerceName }),
    t('codeLine', { codes: codesLine }),
    params.rewardLine,
    t('presentCashier'),
  ]
    .join('\n')
    .concat(exp)
    .concat(next);
}
