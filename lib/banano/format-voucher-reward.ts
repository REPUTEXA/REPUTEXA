import 'server-only';

import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

export type VoucherRewardSnapshot = {
  reward_kind: string;
  reward_percent: number | string | null;
  reward_euro_cents: number | null;
  reward_label: string;
};

function trimPercentDisplay(n: number, locale: string): string {
  const tag = siteLocaleToIntlDateTag(locale);
  const s = new Intl.NumberFormat(tag, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(n);
  return s.replace(/\.?0+$/, '') || '0';
}

/** Ligne lisible « avantage » pour caisse / client (libellés + nombres selon la locale). */
export function formatVoucherRewardLine(
  v: VoucherRewardSnapshot,
  locale?: string | null
): string {
  const loc = normalizeAppLocale(locale ?? undefined);
  const t = createServerTranslator('Loyalty.voucherReward', loc);
  const label = (v.reward_label ?? '').trim() || t('fallbackLabel');
  if (v.reward_kind === 'percent') {
    const p = Number(v.reward_percent);
    if (Number.isFinite(p) && p > 0) {
      return t('percentLine', { percent: trimPercentDisplay(p, loc), label });
    }
  }
  if (v.reward_kind === 'fixed_euro') {
    const c = v.reward_euro_cents != null ? Math.floor(Number(v.reward_euro_cents)) : 0;
    if (c > 0) {
      const euros = c / 100;
      const tag = siteLocaleToIntlDateTag(loc);
      const amount = new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR' }).format(euros);
      return t('fixedEuroLine', { amount, label });
    }
  }
  return label;
}
