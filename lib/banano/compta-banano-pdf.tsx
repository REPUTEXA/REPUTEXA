/**
 * PDF « Expert-Comptable » — remises fidélité & avantages collaborateurs (react-pdf, serveur).
 * Textes : Dashboard.comptaBananoPdf (messages/*.json) · locale = profiles.language.
 */

import React from 'react';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { ComptaBananoMonthlyPayload } from '@/lib/banano/compta-banano-monthly';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { REPUTEXA_PDF } from '@/lib/pdf/reputexa-react-pdf-tokens';
import {
  getSentinelPdfFooterLines,
  SentinelReactPdfFooter,
} from '@/lib/pdf/sentinel-react-pdf-footer';
import { pdfPayloadIntegritySha256Hex } from '@/lib/pdf/sentinel-pdf-integrity';

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const INK = REPUTEXA_PDF.ink;
const MUTED = REPUTEXA_PDF.muted;
const GREEN = '#047857';
const VIOLET = '#6d28d9';

const MAX_DETAIL_LINES = 42;

export async function renderComptaBananoPdfBuffer(params: {
  establishmentName: string;
  payload: ComptaBananoMonthlyPayload;
  locale: string;
}): Promise<Buffer> {
  const { establishmentName, payload, locale } = params;
  const t = createServerTranslator('Dashboard.comptaBananoPdf', locale);
  const intlTag = siteLocaleToIntlDateTag(locale);

  const fmtEur = (cents: number): string =>
    new Intl.NumberFormat(intlTag, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);

  const fmtWhen = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return iso;
      return d.toLocaleString(intlTag, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const name = establishmentName.trim() || t('establishment_fallback');

  const lLines = payload.loyalty.lines;
  const sLines = payload.staff.lines;
  const lTrunc = lLines.length > MAX_DETAIL_LINES;
  const sTrunc = sLines.length > MAX_DETAIL_LINES;
  const lShow = lLines.slice(0, MAX_DETAIL_LINES);
  const sShow = sLines.slice(0, MAX_DETAIL_LINES);
  const generatedAt = new Date();
  const integritySha256Hex = await pdfPayloadIntegritySha256Hex({
    kind: 'compta-banano',
    v: 1,
    establishmentName: name,
    payload,
  });

  const sentinelLines = getSentinelPdfFooterLines(locale, generatedAt, integritySha256Hex);

  const periodLine = t('period_utc', {
    from: fmtWhen(payload.periodStartIso),
    to: fmtWhen(payload.periodEndExclusiveIso),
  });

  return renderToBuffer(
    <Document>
      <Page
        size="A4"
        style={{
          padding: 44,
          fontFamily: FONT,
          color: REPUTEXA_PDF.body,
          backgroundColor: REPUTEXA_PDF.pageBg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottomWidth: 2,
            borderBottomColor: REPUTEXA_PDF.blue,
            paddingBottom: 12,
            marginBottom: 18,
          }}
        >
          <View>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 18, color: REPUTEXA_PDF.navy, letterSpacing: 1.2 }}>
              REPUTEXA
            </Text>
            <Text style={{ fontSize: 9, color: MUTED, marginTop: 4 }}>{t('tagline')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', maxWidth: 220 }}>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, color: INK, marginBottom: 4 }}>{name}</Text>
            <Text style={{ fontSize: 8.5, color: MUTED, textAlign: 'right' }}>{t('partner_note')}</Text>
          </View>
        </View>

        <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: INK, marginBottom: 6 }}>
          {t('title_prefix')} {payload.monthLabel}
        </Text>
        <Text style={{ fontSize: 9, color: MUTED, marginBottom: 16 }}>{periodLine}</Text>

        <View
          style={{
            backgroundColor: '#ecfdf5',
            borderLeftWidth: 3,
            borderLeftColor: GREEN,
            padding: 10,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, color: INK, marginBottom: 6 }}>
            {t('section_loyalty_title')}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('loyalty_bullet_fixed')}{' '}
            <Text style={{ fontFamily: FONT_BOLD }}>{fmtEur(payload.loyalty.totalFixedEuroCents)}</Text>
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('loyalty_bullet_redemptions')} {payload.loyalty.totalRedemptions}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('loyalty_bullet_percent')} {payload.loyalty.percentVoucherCount}
          </Text>
          <Text style={{ fontSize: 9.5 }}>
            {t('loyalty_bullet_label_only')} {payload.loyalty.labelOnlyVoucherCount}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#f5f3ff',
            borderLeftWidth: 3,
            borderLeftColor: VIOLET,
            padding: 10,
            marginBottom: 18,
          }}
        >
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, color: INK, marginBottom: 6 }}>
            {t('section_staff_title')}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('staff_bullet_total')}{' '}
            <Text style={{ fontFamily: FONT_BOLD }}>{fmtEur(payload.staff.totalDebitedCents)}</Text>
          </Text>
          <Text style={{ fontSize: 9.5 }}>
            {t('staff_bullet_moves')} {payload.staff.debitEventCount}
          </Text>
        </View>

        {lShow.length > 0 ? (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, color: INK, marginBottom: 6 }}>
              {t('detail_loyalty')} ({lShow.length}
              {lTrunc ? ` / ${lLines.length}` : ''})
            </Text>
            {lShow.map((l, i) => (
              <Text key={`l-${i}`} style={{ fontSize: 7.8, marginBottom: 3, lineHeight: 1.35 }}>
                {fmtWhen(l.at)} · {l.code} · {l.memberName} · {l.rewardLine}
                {l.euroValueCents != null ? ` · ${fmtEur(l.euroValueCents)}` : ''}
              </Text>
            ))}
            {lTrunc ? (
              <Text style={{ fontSize: 8, color: MUTED, marginTop: 4 }}>
                {t('truncated_lines', { n: lLines.length - MAX_DETAIL_LINES })}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ fontSize: 9, color: MUTED, marginBottom: 12 }}>{t('empty_loyalty')}</Text>
        )}

        {sShow.length > 0 ? (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, color: INK, marginBottom: 6 }}>
              {t('detail_staff')} ({sShow.length}
              {sTrunc ? ` / ${sLines.length}` : ''})
            </Text>
            {sShow.map((l, i) => (
              <Text key={`s-${i}`} style={{ fontSize: 7.8, marginBottom: 3, lineHeight: 1.35 }}>
                {fmtWhen(l.at)} · {l.memberName} · {fmtEur(l.amountCents)}
                {l.note ? ` · ${l.note}` : ''}
              </Text>
            ))}
            {sTrunc ? (
              <Text style={{ fontSize: 8, color: MUTED, marginTop: 4 }}>
                {t('truncated_lines', { n: sLines.length - MAX_DETAIL_LINES })}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ fontSize: 9, color: MUTED, marginBottom: 12 }}>{t('empty_staff')}</Text>
        )}

        <View
          style={{
            marginTop: 10,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#e2e8f0',
          }}
        >
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 9, color: INK, marginBottom: 6 }}>{t('note_title')}</Text>
          <Text style={{ fontSize: 8.2, lineHeight: 1.45, textAlign: 'justify', color: MUTED }}>{t('disclaimer')}</Text>
          <Text style={{ fontSize: 8.2, lineHeight: 1.45, textAlign: 'justify', color: MUTED, marginTop: 8 }}>
            {t('elite_rewards_note')}
          </Text>
        </View>

        <SentinelReactPdfFooter
          generatedLine={sentinelLines.generatedLine}
          integrityLine={sentinelLines.integrityLine}
          pageLine={t('footer_page')}
          left={44}
          right={44}
          bottom={28}
        />
      </Page>
    </Document>
  );
}
