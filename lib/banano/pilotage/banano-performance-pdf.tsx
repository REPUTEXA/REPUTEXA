/**
 * PDF « Rapport de performance IA » — Banano / Pilotage (react-pdf, rendu serveur).
 * Textes : Dashboard.bananoPerformancePdf (messages/*.json) · locale = profil marchand.
 */
import React from 'react';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { BananoPerformanceMonthStats } from '@/lib/banano/pilotage/performance-report-stats';
import type { PerformanceNarrative } from '@/lib/banano/pilotage/generate-performance-narrative';
import type { PilotageCorePayload, TemporalViewKey } from '@/lib/banano/pilotage/types';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { REPUTEXA_PDF } from '@/lib/pdf/reputexa-react-pdf-tokens';
import {
  getSentinelPdfFooterLines,
  SentinelReactPdfFooter,
} from '@/lib/pdf/sentinel-react-pdf-footer';
import { pdfPayloadIntegritySha256Hex } from '@/lib/pdf/sentinel-pdf-integrity';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const INK = REPUTEXA_PDF.ink;
const MUTED = REPUTEXA_PDF.muted;
const ACCENT = REPUTEXA_PDF.blue;

const PDF_FUNNEL_LIST_CAP = 55;

function pctSigned(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
}

export async function renderBananoPerformancePdfBuffer(params: {
  establishmentName: string;
  stats: BananoPerformanceMonthStats;
  narrative: PerformanceNarrative;
  pilotageCore: PilotageCorePayload;
  /** Aligné sur profiles.language (PDF mensuel). */
  locale?: string;
}): Promise<Buffer> {
  const { establishmentName, stats, narrative, pilotageCore, locale: localeRaw } = params;
  const locale = localeRaw ?? 'fr';
  const t = createServerTranslator('Dashboard.bananoPerformancePdf', locale);
  const intlTag = siteLocaleToIntlDateTag(locale);
  const fmtWeek = new Intl.DateTimeFormat(intlTag, { weekday: 'short' });
  const heatDowLabel = (dow: number): string => fmtWeek.format(new Date(2024, 0, 1 + dow));

  const fmtEur = (cents: number): string =>
    new Intl.NumberFormat(intlTag, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);

  const name = establishmentName.trim() || t('establishmentFallback');
  const generatedAt = new Date();
  const integritySha256Hex = await pdfPayloadIntegritySha256Hex({
    kind: 'banano-performance-report',
    v: 1,
    establishmentName: name,
    stats,
    narrative,
    pilotageCore,
  });

  const sentinelLines = getSentinelPdfFooterLines(locale, generatedAt, integritySha256Hex);

  const revenueChangeSuffix =
    stats.revenueChangePct != null
      ? t('revenueChangeSuffix', { pct: pctSigned(stats.revenueChangePct) })
      : '';

  const googleDeltaSuffix =
    stats.googleRatingDelta != null
      ? t('googleDeltaSuffix', { delta: pctSigned(stats.googleRatingDelta) })
      : '';

  const vipLabel =
    stats.retentionFunnel.vipProfilesCount === 1 ? t('vipSheet_one') : t('vipSheet_other');

  const staffWord =
    stats.staffPerformance.rows.length === 1 ? t('staffWord_one') : t('staffWord_other');

  const staffLineBlock =
    stats.staffPerformance.rows.length > 0
      ? t('staffLine_with', {
          count: stats.staffPerformance.rows.length,
          staffWord,
        })
      : t('staffLine_none');

  const temporalBlocks: { key: TemporalViewKey; label: string; hint: string }[] = [
    { key: 'day', label: t('temporal_day_label'), hint: t('temporal_day_hint') },
    { key: 'week', label: t('temporal_week_label'), hint: t('temporal_week_hint') },
    { key: 'month', label: t('temporal_month_label'), hint: t('temporal_month_hint') },
  ];

  const headerLine1 = t('headerMeta', { monthLabel: stats.monthLabel });
  const headerLine2 = t('headerClosing');

  return renderToBuffer(
    <Document>
      <Page
        size="A4"
        style={{
          padding: 48,
          fontFamily: FONT,
          color: REPUTEXA_PDF.body,
          backgroundColor: REPUTEXA_PDF.pageBg,
        }}
      >
        <View
          style={{
            borderBottomWidth: 2,
            borderBottomColor: ACCENT,
            paddingBottom: 14,
            marginBottom: 22,
          }}
        >
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 20, color: INK }}>{t('title')}</Text>
          <Text style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
            {headerLine1}
            {'\n'}
            {headerLine2}
          </Text>
        </View>

        <Text style={{ fontSize: 10, marginBottom: 16 }}>
          <Text style={{ fontFamily: FONT_BOLD }}>{t('establishment')} </Text>
          {name}
        </Text>

        <View
          style={{
            backgroundColor: '#eff6ff',
            borderLeftWidth: 4,
            borderLeftColor: ACCENT,
            padding: 12,
            marginBottom: 18,
          }}
        >
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 12, color: INK, marginBottom: 4 }}>
            {narrative.badge}
          </Text>
          <Text style={{ fontSize: 10, lineHeight: 1.45 }}>{narrative.headline}</Text>
        </View>

        {narrative.formalParagraphs.map((p, i) => (
          <Text
            key={i}
            style={{ fontSize: 10, lineHeight: 1.5, marginBottom: 10, textAlign: 'justify' }}
          >
            {p}
          </Text>
        ))}

        <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, color: INK, marginBottom: 8 }}>
            {t('numericSummaryTitle')}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 4 }}>
            {t('revenue', {
              amount: fmtEur(stats.revenueCents),
              changeSuffix: revenueChangeSuffix,
            })}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 4 }}>
            {t('newMembers', {
              count: stats.newMembersCount,
              amount: fmtEur(stats.newMembersRevenueCents),
            })}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 4 }}>
            {t('visits', { count: stats.visitCount })}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 4 }}>
            {t('loyaltyMonthLine', {
              points: stats.loyaltyMonth.pointsDistributed,
              stamps: stats.loyaltyMonth.stampsEarned,
              vouchers: stats.loyaltyMonth.vouchersGenerated,
            })}
          </Text>
          <Text style={{ fontSize: 9.5 }}>
            {t('googleLine', {
              avg: stats.googleAvgThis.toFixed(1),
              deltaSuffix: googleDeltaSuffix,
              count: stats.googleReviewCountThis,
            })}
          </Text>
          <Text style={{ fontSize: 9.5, marginTop: 8 }}>
            {t('retention', {
              newClients: stats.retentionFunnel.newClientsThisMonth,
              returned: stats.retentionFunnel.returnedAtLeastTwiceThisMonth,
              vipCount: stats.retentionFunnel.vipProfilesCount,
              vipLabel,
            })}
          </Text>
          <Text style={{ fontSize: 9.5, marginTop: 4 }}>{staffLineBlock}</Text>

          {stats.cashTerminalMonth.length > 0 || stats.cashStaffMonth.length > 0 ? (
            <>
              <Text
                style={{
                  fontFamily: FONT_BOLD,
                  fontSize: 10,
                  marginTop: 12,
                  marginBottom: 4,
                  color: INK,
                }}
              >
                {t('cashSyncPdfBlockTitle')}
              </Text>
              <Text style={{ fontSize: 8.5, color: MUTED, marginBottom: 6, lineHeight: 1.35 }}>
                {t('cashSyncPdfBlockIntro')}
              </Text>
            </>
          ) : null}

          {stats.cashTerminalMonth.length > 0 ? (
            <>
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 9.5, marginBottom: 4, color: INK }}>
                {t('cashSyncPdfTerminalTitle')}
              </Text>
              <View style={{ borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    borderBottomWidth: 1,
                    borderBottomColor: '#e2e8f0',
                    backgroundColor: '#f1f5f9',
                    paddingVertical: 4,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '40%' }}>
                    {t('cashSyncPdfColTerminal')}
                  </Text>
                  <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '22%', textAlign: 'right' }}>
                    {t('cashSyncPdfColTickets')}
                  </Text>
                  <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '38%', textAlign: 'right' }}>
                    {t('cashSyncPdfColCa')}
                  </Text>
                </View>
                {stats.cashTerminalMonth.map((row, idx, arr) => (
                  <View
                    key={row.terminalId}
                    style={{
                      flexDirection: 'row',
                      borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                      borderBottomColor: '#f1f5f9',
                      paddingVertical: 3,
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text style={{ fontSize: 7, width: '40%' }}>{row.terminalId}</Text>
                    <Text style={{ fontSize: 7, width: '22%', textAlign: 'right' }}>
                      {row.ticketCount}
                    </Text>
                    <Text style={{ fontSize: 7, width: '38%', textAlign: 'right' }}>
                      {fmtEur(row.revenueCents)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {stats.cashStaffMonth.length > 0 ? (
            <>
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 9.5, marginBottom: 4, color: INK }}>
                {t('cashSyncPdfStaffTitle')}
              </Text>
              <View style={{ borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    borderBottomWidth: 1,
                    borderBottomColor: '#e2e8f0',
                    backgroundColor: '#f1f5f9',
                    paddingVertical: 4,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '34%' }}>
                    {t('cashSyncPdfColStaff')}
                  </Text>
                  <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '18%', textAlign: 'right' }}>
                    {t('cashSyncPdfColTickets')}
                  </Text>
                  <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '28%', textAlign: 'right' }}>
                    {t('cashSyncPdfColCa')}
                  </Text>
                  <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '20%', textAlign: 'right' }}>
                    {t('cashSyncPdfColCapture')}
                  </Text>
                </View>
                {stats.cashStaffMonth.map((row, idx, arr) => (
                  <View
                    key={`${row.staffName}-${idx}`}
                    style={{
                      flexDirection: 'row',
                      borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                      borderBottomColor: '#f1f5f9',
                      paddingVertical: 3,
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text style={{ fontSize: 7, width: '34%' }}>{row.staffName}</Text>
                    <Text style={{ fontSize: 7, width: '18%', textAlign: 'right' }}>
                      {row.ticketCount}
                    </Text>
                    <Text style={{ fontSize: 7, width: '28%', textAlign: 'right' }}>
                      {fmtEur(row.revenueCents)}
                    </Text>
                    <Text style={{ fontSize: 7, width: '20%', textAlign: 'right' }}>
                      {row.capturePercent.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
              {narrative.employeeOfMonthLine ? (
                <Text style={{ fontSize: 9.5, marginBottom: 6, lineHeight: 1.45, fontStyle: 'italic' }}>
                  {narrative.employeeOfMonthLine}
                </Text>
              ) : null}
            </>
          ) : null}

          <Text
            style={{ fontFamily: FONT_BOLD, fontSize: 10, marginTop: 12, marginBottom: 4, color: INK }}
          >
            {t('whatsappRelancesTitle')}
          </Text>
          <Text style={{ fontSize: 8.5, color: MUTED, marginBottom: 6, lineHeight: 1.35 }}>
            {t('whatsappRelancesIntro')}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('whatsappRelanceLost', {
              state: stats.whatsappRelances.rulesEnabled.lost_client
                ? t('whatsappRelanceOn')
                : t('whatsappRelanceOff'),
              sends: stats.whatsappRelances.sendsMonth.lost_client,
            })}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('whatsappRelanceWelcome', {
              state: stats.whatsappRelances.rulesEnabled.new_client_welcome
                ? t('whatsappRelanceOn')
                : t('whatsappRelanceOff'),
              sends: stats.whatsappRelances.sendsMonth.new_client_welcome,
            })}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('whatsappRelanceBirthday', {
              state: stats.whatsappRelances.rulesEnabled.birthday
                ? t('whatsappRelanceOn')
                : t('whatsappRelanceOff'),
              sends: stats.whatsappRelances.sendsMonth.birthday,
            })}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('whatsappRelanceVip', {
              state: stats.whatsappRelances.rulesEnabled.vip_of_month
                ? t('whatsappRelanceOn')
                : t('whatsappRelanceOff'),
              sends: stats.whatsappRelances.sendsMonth.vip_of_month,
            })}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 2 }}>
            {t('whatsappRelanceAggregate', {
              sends: stats.whatsappRelances.aggregateSendsMonth,
              amount: fmtEur(stats.whatsappRelances.attributedRevenueCents),
            })}
          </Text>

          <Text
            style={{ fontFamily: FONT_BOLD, fontSize: 10, marginTop: 14, marginBottom: 4, color: INK }}
          >
            {t('loyaltyValueTitle')}
          </Text>
          <Text style={{ fontSize: 8.5, color: MUTED, marginBottom: 8, lineHeight: 1.35 }}>
            {t('loyaltyValueIntro')}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('loyaltyCaGross', { amount: fmtEur(stats.revenueCents) })}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('loyaltyFixedRedeemed', {
              amount: fmtEur(stats.loyaltyValue.costBreakdown.totalFixedEuroRedeemedCents),
            })}
          </Text>
          <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
            {t('loyaltyCaNet', { amount: fmtEur(stats.loyaltyValue.revenueNetAfterFixedVoucherCents) })}
          </Text>
          {stats.loyaltyValue.revenueToFixedRedemptionRatio != null ? (
            <Text style={{ fontSize: 9.5, marginBottom: 3 }}>
              {t('loyaltyRoiLine', { ratio: String(stats.loyaltyValue.revenueToFixedRedemptionRatio) })}
            </Text>
          ) : (
            <Text style={{ fontSize: 9.5, marginBottom: 3 }}>{t('loyaltyRoiNone')}</Text>
          )}
          <Text style={{ fontSize: 9.5, marginBottom: 8 }}>
            {t('loyaltySignupIssued', {
              count: stats.loyaltyValue.costBreakdown.signupVouchersIssuedInMonth,
              amount: fmtEur(stats.loyaltyValue.costBreakdown.signupIssuedFixedEuroCents),
              pctCount: stats.loyaltyValue.costBreakdown.signupIssuedPercentCount,
              labelCount: stats.loyaltyValue.costBreakdown.signupIssuedLabelOnlyCount,
            })}
          </Text>

          <Text style={{ fontFamily: FONT_BOLD, fontSize: 9.5, marginBottom: 4, color: INK }}>
            {t('loyaltyCostsTableTitle')}
          </Text>
          <View style={{ borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 }}>
            <View
              style={{
                flexDirection: 'row',
                borderBottomWidth: 1,
                borderBottomColor: '#e2e8f0',
                backgroundColor: '#f1f5f9',
                paddingVertical: 4,
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '34%' }}>
                {t('loyaltyCostsColClass')}
              </Text>
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '18%', textAlign: 'right' }}>
                {t('loyaltyCostsColCount')}
              </Text>
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '26%', textAlign: 'right' }}>
                {t('loyaltyCostsColFixed')}
              </Text>
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '22%', textAlign: 'right' }}>
                {t('loyaltyCostsColOther')}
              </Text>
            </View>
            {(stats.loyaltyValue.costBreakdown.redeemedByClass.length > 0
              ? stats.loyaltyValue.costBreakdown.redeemedByClass
              : []
            ).map((row, idx, arr) => {
              const labelKey = [
                'signup_welcome',
                'loyalty_threshold',
                'birthday_gift',
                'elite_reward',
                'staff_allowance',
              ].includes(row.voucherClass)
                ? (`loyaltyClass_${row.voucherClass}` as const)
                : 'loyaltyClass_other';
              const classLabel = t(labelKey);
              return (
                <View
                  key={row.voucherClass}
                  style={{
                    flexDirection: 'row',
                    borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                    borderBottomColor: '#f1f5f9',
                    paddingVertical: 3,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontSize: 7, width: '34%' }}>{classLabel}</Text>
                  <Text style={{ fontSize: 7, width: '18%', textAlign: 'right' }}>
                    {row.redeemedCount}
                  </Text>
                  <Text style={{ fontSize: 7, width: '26%', textAlign: 'right' }}>
                    {row.fixedEuroRedeemedCents > 0 ? fmtEur(row.fixedEuroRedeemedCents) : t('dash')}
                  </Text>
                  <Text style={{ fontSize: 7, width: '22%', textAlign: 'right' }}>
                    {row.nonFixedRedeemedCount > 0 ? String(row.nonFixedRedeemedCount) : t('dash')}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text
            style={{ fontFamily: FONT_BOLD, fontSize: 9.5, marginTop: 10, marginBottom: 4, color: INK }}
          >
            {t('loyaltyStaffTableTitle')}
          </Text>
          <Text style={{ fontSize: 7.5, color: MUTED, marginBottom: 5, lineHeight: 1.35 }}>
            {t('loyaltyStaffTableIntro')}
          </Text>
          {stats.loyaltyValue.costBreakdown.fixedRedemptionsByStaff.length > 0 ? (
            <View style={{ borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderBottomColor: '#e2e8f0',
                  backgroundColor: '#f1f5f9',
                  paddingVertical: 4,
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '28%' }}>
                  {t('loyaltyStaffColName')}
                </Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '14%', textAlign: 'right' }}>
                  {t('loyaltyStaffColUses')}
                </Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '22%', textAlign: 'right' }}>
                  {t('loyaltyStaffColFixed')}
                </Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '18%', textAlign: 'right' }}>
                  {t('loyaltyStaffColOther')}
                </Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, width: '18%', textAlign: 'right' }}>
                  {t('loyaltyStaffColCollabDebit')}
                </Text>
              </View>
              {stats.loyaltyValue.costBreakdown.fixedRedemptionsByStaff.map((row, idx, arr) => (
                <View
                  key={`${row.staffId ?? 'none'}-${idx}`}
                  style={{
                    flexDirection: 'row',
                    borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                    borderBottomColor: '#f1f5f9',
                    paddingVertical: 3,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontSize: 7, width: '28%' }}>{row.staffDisplayName}</Text>
                  <Text style={{ fontSize: 7, width: '14%', textAlign: 'right' }}>
                    {row.voucherRedeemCount}
                  </Text>
                  <Text style={{ fontSize: 7, width: '22%', textAlign: 'right' }}>
                    {row.fixedEuroFromVoucherRedeemsCents > 0
                      ? fmtEur(row.fixedEuroFromVoucherRedeemsCents)
                      : t('dash')}
                  </Text>
                  <Text style={{ fontSize: 7, width: '18%', textAlign: 'right' }}>
                    {row.nonFixedVoucherRedeemCount > 0
                      ? String(row.nonFixedVoucherRedeemCount)
                      : t('dash')}
                  </Text>
                  <Text style={{ fontSize: 7, width: '18%', textAlign: 'right' }}>
                    {row.staffAllowanceDebitCents > 0
                      ? fmtEur(row.staffAllowanceDebitCents)
                      : t('dash')}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 8, color: MUTED, marginBottom: 6 }}>{t('loyaltyStaffTableEmpty')}</Text>
          )}
        </View>

        <SentinelReactPdfFooter
          generatedLine={sentinelLines.generatedLine}
          integrityLine={sentinelLines.integrityLine}
          pageLine={t('footerPage1of4')}
          left={48}
          right={48}
          bottom={30}
        />
      </Page>

      <Page
        size="A4"
        style={{
          padding: 48,
          fontFamily: FONT,
          color: REPUTEXA_PDF.body,
          backgroundColor: REPUTEXA_PDF.pageBg,
        }}
      >
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: INK, marginBottom: 6 }}>
          {t('temporalTitle')}
        </Text>
        <Text style={{ fontSize: 9.5, color: MUTED, marginBottom: 16, lineHeight: 1.45 }}>
          {t('temporalIntro')}
        </Text>

        {temporalBlocks.map(({ key, label, hint }) => {
          const b = pilotageCore.temporal[key];
          return (
            <View
              key={key}
              style={{
                marginBottom: 14,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}
            >
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, color: ACCENT, marginBottom: 4 }}>
                {label} — {hint}
              </Text>
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, color: INK, marginBottom: 3 }}>{b.headline}</Text>
              <Text style={{ fontSize: 9.5, lineHeight: 1.45, marginBottom: 5 }}>{b.subline}</Text>
              <Text style={{ fontSize: 9.5, lineHeight: 1.45, color: '#475569' }}>
                {t('insightPrefix')} {b.insight}
              </Text>
            </View>
          );
        })}

        {!pilotageCore.hasTicketAmounts ? (
          <View
            style={{
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 10,
              marginBottom: 16,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 9.5, lineHeight: 1.5 }}>{t('noTicketAmounts')}</Text>
          </View>
        ) : null}

        <Text style={{ fontFamily: FONT_BOLD, fontSize: 12, color: INK, marginBottom: 5, marginTop: 4 }}>
          {t('dailyRegisterTitle')}
        </Text>
        <Text style={{ fontSize: 8.5, color: MUTED, marginBottom: 8, lineHeight: 1.45 }}>
          {t('dailyRegisterIntro')}
        </Text>
        <View style={{ borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderBottomColor: '#e2e8f0',
              backgroundColor: '#f1f5f9',
              paddingVertical: 4,
              paddingHorizontal: 3,
            }}
          >
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 6.5, width: '22%' }}>{t('col_day')}</Text>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 6.5, width: '9%', textAlign: 'right' }}>
              {t('col_pass')}
            </Text>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 6.5, width: '14%', textAlign: 'right' }}>
              {t('col_ca')}
            </Text>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 6.5, width: '14%', textAlign: 'right' }}>
              {t('col_basket')}
            </Text>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 6.5, width: '9%', textAlign: 'right' }}>
              {t('col_art')}
            </Text>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 6.5, width: '32%' }}>{t('col_topLabels')}</Text>
          </View>
          {pilotageCore.dailyActivity.map((row, idx) => {
            const labels =
              row.topLabels.length > 0
                ? row.topLabels.map((l) => `«${l.text}»×${l.count}`).join(' ')
                : t('dash');
            return (
              <View
                key={row.dateKey}
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: idx < pilotageCore.dailyActivity.length - 1 ? 1 : 0,
                  borderBottomColor: '#f1f5f9',
                  paddingVertical: 3,
                  paddingHorizontal: 3,
                }}
              >
                <Text style={{ fontSize: 6.5, width: '22%' }}>{row.labelFr}</Text>
                <Text style={{ fontSize: 6.5, width: '9%', textAlign: 'right' }}>{row.visitCount}</Text>
                <Text style={{ fontSize: 6.5, width: '14%', textAlign: 'right' }}>
                  {row.revenueCents > 0 ? fmtEur(row.revenueCents) : t('dash')}
                </Text>
                <Text style={{ fontSize: 6.5, width: '14%', textAlign: 'right' }}>
                  {row.avgBasketCents != null ? fmtEur(row.avgBasketCents) : t('dash')}
                </Text>
                <Text style={{ fontSize: 6.5, width: '9%', textAlign: 'right' }}>
                  {row.itemsSold != null ? String(row.itemsSold) : t('dash')}
                </Text>
                <Text style={{ fontSize: 6, width: '32%', lineHeight: 1.25 }}>{labels}</Text>
              </View>
            );
          })}
        </View>

        <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: INK, marginBottom: 6, marginTop: 6 }}>
          {t('smartCardsTitle')}
        </Text>
        <Text style={{ fontSize: 9.5, color: MUTED, marginBottom: 12, lineHeight: 1.45 }}>
          {t('smartCardsIntro')}
        </Text>

        {pilotageCore.smartCards.map((card) => (
          <View
            key={card.id}
            style={{
              marginBottom: 12,
              paddingLeft: 10,
              borderLeftWidth: 3,
              borderLeftColor: '#cbd5e1',
            }}
          >
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, color: INK }}>
              {card.emoji} {card.title}
            </Text>
            <Text style={{ fontSize: 9.5, lineHeight: 1.45, marginTop: 3 }}>{card.body}</Text>
            {card.ctaLabel ? (
              <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 4 }}>
                {t('actionSuggested', { label: card.ctaLabel })}
              </Text>
            ) : null}
          </View>
        ))}

        <SentinelReactPdfFooter
          generatedLine={sentinelLines.generatedLine}
          integrityLine={sentinelLines.integrityLine}
          pageLine={t('footerPage2of4')}
          left={48}
          right={48}
          bottom={30}
        />
      </Page>

      <Page
        size="A4"
        style={{
          padding: 48,
          fontFamily: FONT,
          color: REPUTEXA_PDF.body,
          backgroundColor: REPUTEXA_PDF.pageBg,
        }}
      >
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: INK, marginBottom: 6 }}>
          {t('retentionStaffTitle')}
        </Text>
        <Text style={{ fontSize: 9.5, color: MUTED, marginBottom: 14, lineHeight: 1.45 }}>
          {t('retentionStaffIntro')}
        </Text>

        <View
          style={{
            marginBottom: 18,
            padding: 12,
            backgroundColor: '#f8fafc',
            borderRadius: 4,
            borderWidth: 1,
            borderColor: '#e2e8f0',
          }}
        >
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, marginBottom: 6, color: INK }}>
            {t('funnelTitle')}
          </Text>
          <Text style={{ fontSize: 9.5, lineHeight: 1.5 }}>
            {t('funnelNew', { n: stats.retentionFunnel.newClientsThisMonth })}
          </Text>
          <Text style={{ fontSize: 9.5, lineHeight: 1.5 }}>
            {t('funnelReturned', { n: stats.retentionFunnel.returnedAtLeastTwiceThisMonth })}
          </Text>
          <Text style={{ fontSize: 9.5, lineHeight: 1.5 }}>
            {t('funnelVip', { n: stats.retentionFunnel.vipProfilesCount })}
          </Text>
        </View>

        <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, marginBottom: 6, marginTop: 12, color: INK }}>
          {t('heatWeekPdfTitle')}
        </Text>
        <Text style={{ fontSize: 8.5, color: MUTED, marginBottom: 8, lineHeight: 1.45 }}>
          {t('heatWeekPdfIntro')}
        </Text>
        {stats.weekdayHeat.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              marginBottom: 16,
              paddingVertical: 8,
              paddingHorizontal: 4,
              backgroundColor: '#f8fafc',
              borderRadius: 4,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}
          >
            {stats.weekdayHeat.map((cell) => (
              <View key={cell.dow} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7.5, color: INK, marginBottom: 4 }}>
                  {heatDowLabel(cell.dow)}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: FONT_BOLD, color: ACCENT }}>{cell.count}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 9, color: MUTED, marginBottom: 14 }}>{t('heatWeekPdfEmpty')}</Text>
        )}

        {stats.staffPerformance.rows.length > 0 ? (
          <>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, color: INK, marginBottom: 6 }}>
              {t('staffTableTitle')}
            </Text>
            <View style={{ borderWidth: 1, borderColor: '#e2e8f0' }}>
              <View
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderBottomColor: '#e2e8f0',
                  backgroundColor: '#f1f5f9',
                  paddingVertical: 6,
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7.5, width: '26%' }}>{t('staffCol_name')}</Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7.5, width: '10%', textAlign: 'right' }}>
                  {t('staffCol_tickets')}
                </Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7.5, width: '10%', textAlign: 'right' }}>
                  {t('staffCol_profiles')}
                </Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7.5, width: '18%', textAlign: 'right' }}>
                  {t('staffCol_ca')}
                </Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7.5, width: '12%', textAlign: 'right' }}>
                  {t('staffCol_pct')}
                </Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 7.5, width: '24%', textAlign: 'right' }}>
                  {t('staffCol_reviews')}
                </Text>
              </View>
              {stats.staffPerformance.rows.map((r, idx) => (
                <View
                  key={`${r.display_name}-${idx}`}
                  style={{
                    flexDirection: 'row',
                    borderBottomWidth: idx < stats.staffPerformance.rows.length - 1 ? 1 : 0,
                    borderBottomColor: '#f1f5f9',
                    paddingVertical: 5,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontSize: 8, width: '26%' }}>{r.display_name}</Text>
                  <Text style={{ fontSize: 8, width: '10%', textAlign: 'right' }}>{r.ticketsEncaisse}</Text>
                  <Text style={{ fontSize: 8, width: '10%', textAlign: 'right' }}>{r.clientsCreated}</Text>
                  <Text style={{ fontSize: 8, width: '18%', textAlign: 'right' }}>
                    {fmtEur(r.revenueCents)}
                  </Text>
                  <Text style={{ fontSize: 8, width: '12%', textAlign: 'right' }}>
                    {r.transformPercent.toFixed(1)} %
                  </Text>
                  <Text style={{ fontSize: 8, width: '24%', textAlign: 'right' }}>
                    {r.googlePositiveReviews}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 8, lineHeight: 1.4 }}>
              {t('staffFootnote')}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 9.5, lineHeight: 1.5, color: '#64748b' }}>{t('staffEmpty')}</Text>
        )}

        <SentinelReactPdfFooter
          generatedLine={sentinelLines.generatedLine}
          integrityLine={sentinelLines.integrityLine}
          pageLine={t('footerPage3of4')}
          left={48}
          right={48}
          bottom={30}
        />
      </Page>

      <Page
        size="A4"
        style={{
          padding: 48,
          fontFamily: FONT,
          color: REPUTEXA_PDF.body,
          backgroundColor: REPUTEXA_PDF.pageBg,
        }}
      >
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: INK, marginBottom: 6 }}>
          {t('annexFunnelTitle')}
        </Text>
        <Text style={{ fontSize: 9.5, color: MUTED, marginBottom: 14, lineHeight: 1.45 }}>
          {t('annexFunnelIntro')}
        </Text>

        <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, color: INK, marginBottom: 5 }}>
          {t('annexListNewTitle')}
        </Text>
        {stats.retentionFunnelDetail.newMembers.length === 0 ? (
          <Text style={{ fontSize: 9, color: MUTED, marginBottom: 12 }}>{t('annexListEmpty')}</Text>
        ) : (
          <>
            {stats.retentionFunnelDetail.newMembers.slice(0, PDF_FUNNEL_LIST_CAP).map((m, i) => (
              <Text key={`n-${m.id}-${i}`} style={{ fontSize: 8.5, lineHeight: 1.4, marginBottom: 2 }}>
                · {m.label}
              </Text>
            ))}
            {stats.retentionFunnelDetail.newMembers.length > PDF_FUNNEL_LIST_CAP ? (
              <Text style={{ fontSize: 8, color: MUTED, marginTop: 4 }}>
                {t('annexListTruncated', {
                  n: stats.retentionFunnelDetail.newMembers.length - PDF_FUNNEL_LIST_CAP,
                })}
              </Text>
            ) : null}
          </>
        )}

        <Text
          style={{ fontFamily: FONT_BOLD, fontSize: 10, color: INK, marginBottom: 5, marginTop: 14 }}
        >
          {t('annexListReturnedTitle')}
        </Text>
        {stats.retentionFunnelDetail.returnedTwice.length === 0 ? (
          <Text style={{ fontSize: 9, color: MUTED, marginBottom: 12 }}>{t('annexListEmpty')}</Text>
        ) : (
          <>
            {stats.retentionFunnelDetail.returnedTwice.slice(0, PDF_FUNNEL_LIST_CAP).map((m, i) => (
              <Text key={`r-${m.id}-${i}`} style={{ fontSize: 8.5, lineHeight: 1.4, marginBottom: 2 }}>
                · {m.label} — {t('annexVisitsInMonth', { n: m.visitsInMonth })}
              </Text>
            ))}
            {stats.retentionFunnelDetail.returnedTwice.length > PDF_FUNNEL_LIST_CAP ? (
              <Text style={{ fontSize: 8, color: MUTED, marginTop: 4 }}>
                {t('annexListTruncated', {
                  n: stats.retentionFunnelDetail.returnedTwice.length - PDF_FUNNEL_LIST_CAP,
                })}
              </Text>
            ) : null}
          </>
        )}

        <Text
          style={{ fontFamily: FONT_BOLD, fontSize: 10, color: INK, marginBottom: 5, marginTop: 14 }}
        >
          {t('annexListVipTitle')}
        </Text>
        {stats.retentionFunnelDetail.vipProfiles.length === 0 ? (
          <Text style={{ fontSize: 9, color: MUTED, marginBottom: 12 }}>{t('annexListEmpty')}</Text>
        ) : (
          <>
            {stats.retentionFunnelDetail.vipProfiles.slice(0, PDF_FUNNEL_LIST_CAP).map((m, i) => (
              <Text key={`v-${m.id}-${i}`} style={{ fontSize: 8.5, lineHeight: 1.4, marginBottom: 2 }}>
                · {m.label} — {t('annexLifetimeVisits', { n: m.lifetimeVisits })}
              </Text>
            ))}
            {stats.retentionFunnelDetail.vipProfiles.length > PDF_FUNNEL_LIST_CAP ? (
              <Text style={{ fontSize: 8, color: MUTED, marginTop: 4 }}>
                {t('annexListTruncated', {
                  n: stats.retentionFunnelDetail.vipProfiles.length - PDF_FUNNEL_LIST_CAP,
                })}
              </Text>
            ) : null}
          </>
        )}

        <SentinelReactPdfFooter
          generatedLine={sentinelLines.generatedLine}
          integrityLine={sentinelLines.integrityLine}
          pageLine={t('footerPage4of4')}
          left={48}
          right={48}
          bottom={30}
        />
      </Page>
    </Document>
  );
}
