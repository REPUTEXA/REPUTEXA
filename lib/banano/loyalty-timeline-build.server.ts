import 'server-only';

import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import type {
  LoyaltyEventRow,
  ReviewTimelineRow,
  TimelineDetailRow,
  TimelineItem,
} from '@/lib/banano/loyalty-timeline-labels';

function formatLongDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(siteLocaleToIntlDateTag(locale), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatLongDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(siteLocaleToIntlDateTag(locale), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtSigned(
  n: number,
  singularKey: string,
  pluralKey: string,
  t: (k: string) => string
): string {
  if (n === 0) return t('dash');
  const abs = Math.abs(n);
  const u = abs === 1 ? t(singularKey) : t(pluralKey);
  return `${n > 0 ? '+' : '-'}${abs} ${u}`;
}

function eventTypeLabel(
  eventType: string,
  t: (k: string) => string
): string {
  switch (eventType) {
    case 'earn_points':
      return t('eventEarnPoints');
    case 'earn_stamps':
      return t('eventEarnStamps');
    case 'encaisser_reward':
      return t('eventEncaisser');
    case 'redeem_points':
      return t('eventRedeemPoints');
    case 'redeem_stamps':
      return t('eventRedeemStamps');
    case 'member_created':
      return t('eventMemberCreated');
    case 'voucher_issued':
      return t('eventVoucherIssued');
    case 'voucher_redeemed':
      return t('eventVoucherRedeemed');
    case 'staff_allowance_issued':
      return t('eventStaffIssued');
    case 'staff_allowance_debit':
      return t('eventStaffDebit');
    case 'staff_allowance_merchant_adjust':
      return t('eventStaffAdjust');
    default:
      return t('eventDefault');
  }
}

function staffEarnSuffix(
  ev: LoyaltyEventRow,
  t: (k: string, values?: Record<string, string>) => string
): string {
  const n = (ev.staff_display_name ?? '').trim();
  return n ? t('suffixEarn', { name: n }) : '';
}

function staffParSuffix(
  ev: LoyaltyEventRow,
  t: (k: string, values?: Record<string, string>) => string
): string {
  const n = (ev.staff_display_name ?? '').trim();
  return n ? t('suffixPar', { name: n }) : '';
}

function loyaltyLabel(
  ev: LoyaltyEventRow,
  locale: string,
  t: (k: string, values?: Record<string, string | number>) => string
): string {
  const date = formatLongDate(ev.created_at, locale);
  const note = (ev.note ?? '').trim();

  switch (ev.event_type) {
    case 'member_created':
      return t('memberCreated', { date, suffix: staffParSuffix(ev, t) });
    case 'earn_points':
      if (note) {
        return t('earnWithNote', { note, date, suffix: staffEarnSuffix(ev, t) });
      }
      return t('earnPointsLine', {
        delta: ev.delta_points,
        unit: ev.delta_points === 1 || ev.delta_points === -1 ? t('unitPoint') : t('unitPoints'),
        date,
        suffix: staffEarnSuffix(ev, t),
      });
    case 'earn_stamps':
      if (note) {
        return t('earnWithNote', { note, date, suffix: staffEarnSuffix(ev, t) });
      }
      return t('earnStampsLine', {
        delta: ev.delta_stamps,
        unit: ev.delta_stamps === 1 || ev.delta_stamps === -1 ? t('unitStamp') : t('unitStamps'),
        date,
        suffix: staffEarnSuffix(ev, t),
      });
    case 'encaisser_reward': {
      const detail = note || t('rewardFallbackEncaisser');
      return t('encaisserLine', { detail, date, suffix: staffParSuffix(ev, t) });
    }
    case 'redeem_points': {
      const n = Math.abs(ev.delta_points);
      return t('redeemPointsLine', {
        n,
        unit: n === 1 ? t('unitPoint') : t('unitPoints'),
        date,
        suffix: staffParSuffix(ev, t),
      });
    }
    case 'redeem_stamps': {
      const n = Math.abs(ev.delta_stamps);
      return t('redeemStampsLine', {
        n,
        unit: n === 1 ? t('unitStamp') : t('unitStamps'),
        date,
        suffix: staffParSuffix(ev, t),
      });
    }
    case 'voucher_issued': {
      const detail = note || t('rewardFallbackIssued');
      return t('voucherIssuedLine', { detail, date, suffix: staffParSuffix(ev, t) });
    }
    case 'voucher_redeemed': {
      const detail = note || t('rewardFallbackRedeemed');
      return t('voucherRedeemedLine', { detail, date, suffix: staffParSuffix(ev, t) });
    }
    default:
      return t('defaultActivity', { date });
  }
}

function loyaltyDetail(
  ev: LoyaltyEventRow,
  locale: string,
  t: (k: string, values?: Record<string, string | number>) => string
): TimelineItem['detail'] {
  const note = (ev.note ?? '').trim();
  const st = (ev.staff_display_name ?? '').trim();
  const rows: TimelineDetailRow[] = [
    { label: t('rowType'), value: eventTypeLabel(ev.event_type, t) },
    { label: t('rowTechnicalCode'), value: ev.event_type },
    { label: t('rowDateTime'), value: formatLongDateTime(ev.created_at, locale) },
    { label: t('rowNote'), value: note || t('dash') },
    ...(typeof ev.items_count === 'number' && ev.items_count > 0
      ? ([{ label: t('rowItems'), value: String(ev.items_count) }] as TimelineDetailRow[])
      : []),
    { label: t('rowStaff'), value: st || t('dash') },
    {
      label: t('rowPointsCol'),
      value: fmtSigned(ev.delta_points, 'unitPoint', 'unitPoints', t),
    },
    {
      label: t('rowStampsCol'),
      value: fmtSigned(ev.delta_stamps, 'unitStamp', 'unitStamps', t),
    },
    { label: t('rowEventId'), value: ev.id },
  ];
  return {
    title: loyaltyLabel(ev, locale, t),
    rows,
  };
}

function reviewDetail(
  r: ReviewTimelineRow,
  locale: string,
  t: (k: string, values?: Record<string, string | number>) => string
): TimelineItem['detail'] {
  const rows: TimelineDetailRow[] = [
    { label: t('reviewRating'), value: `${r.rating} / 5` },
    { label: t('reviewSource'), value: (r.source ?? '').trim() || t('dash') },
    { label: t('reviewDateTime'), value: formatLongDateTime(r.created_at, locale) },
    { label: t('reviewId'), value: r.id },
  ];
  return {
    title: t('reviewTitle', { rating: r.rating }),
    rows,
  };
}

export function buildTimelineItems(
  events: LoyaltyEventRow[],
  reviews: ReviewTimelineRow[],
  locale: string
): TimelineItem[] {
  const t = createServerTranslator('Loyalty.timeline', locale);
  const out: TimelineItem[] = [];

  for (const ev of events) {
    out.push({
      id: `loyalty-${ev.id}`,
      kind: 'loyalty',
      at: ev.created_at,
      label: loyaltyLabel(ev, locale, t),
      detail: loyaltyDetail(ev, locale, t),
    });
  }

  for (const r of reviews) {
    const sourcePart = r.source?.trim() ? ` (${r.source})` : '';
    out.push({
      id: `review-${r.id}`,
      kind: 'review',
      at: r.created_at,
      label: t('reviewLeft', {
        rating: r.rating,
        sourcePart,
        date: formatLongDate(r.created_at, locale),
      }),
      detail: reviewDetail(r, locale, t),
    });
  }

  out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return out;
}
