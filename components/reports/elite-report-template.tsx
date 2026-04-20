/**
 * Template PDF magazine-style — Rapport de Cabinet de Conseil.
 * Page de garde, édito IA, infographies.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SummaryStats } from '@/lib/monthly-reports/types';
import { REPUTEXA_PDF } from '@/lib/pdf/reputexa-react-pdf-tokens';
import { SentinelReactPdfFooter } from '@/lib/pdf/sentinel-react-pdf-footer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    paddingTop: 40,
    paddingHorizontal: 40,
    color: REPUTEXA_PDF.ink,
    backgroundColor: REPUTEXA_PDF.pageBg,
  },
  cover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: REPUTEXA_PDF.navy,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: REPUTEXA_PDF.white,
    marginBottom: 8,
    letterSpacing: 2,
  },
  coverSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 48,
  },
  coverEstablishment: {
    fontSize: 18,
    fontWeight: 600,
    color: REPUTEXA_PDF.blue,
  },
  coverPeriod: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: REPUTEXA_PDF.ink,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: REPUTEXA_PDF.blue,
    paddingBottom: 6,
  },
  editorial: {
    marginBottom: 24,
    lineHeight: 1.6,
  },
  statRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: REPUTEXA_PDF.rowAlt,
    borderWidth: 1,
    borderColor: REPUTEXA_PDF.border,
  },
  statLabel: {
    fontSize: 9,
    color: REPUTEXA_PDF.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: REPUTEXA_PDF.ink,
  },
  insightBlock: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: REPUTEXA_PDF.blue,
    backgroundColor: REPUTEXA_PDF.rowAlt,
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: REPUTEXA_PDF.ink,
    marginBottom: 4,
  },
  insightText: {
    fontSize: 10,
    color: REPUTEXA_PDF.body,
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 10,
    color: REPUTEXA_PDF.body,
    marginBottom: 6,
    paddingLeft: 12,
  },
});

type GroupComparisonItem = { name: string; avgRating: number; totalReviews: number; id?: string };

/** Traductions `EliteMonthlyPdf` (messages/*.json), injectées depuis le build PDF serveur. */
export type EliteMonthlyPdfT = (
  key: string,
  values?: Record<string, string | number | boolean>
) => string;

type EliteReportProps = {
  eliteT: EliteMonthlyPdfT;
  establishmentName: string;
  monthLabel: string;
  averageRating: number;
  totalReviews: number;
  positiveCount: number;
  negativeCount: number;
  platforms: { name: string; count: number }[];
  summaryStats: SummaryStats;
  /** Mois précédent — pour afficher l'évolution */
  previousMonthRating?: number;
  previousMonthReviews?: number;
  /** Multi-établissements : condensé groupe */
  groupComparison?: GroupComparisonItem[];
  sentinelFooter: { generatedLine: string; integrityLine: string };
};

const hasEvolution = (p: EliteReportProps) =>
  (p.previousMonthRating != null && p.previousMonthRating > 0) ||
  (p.previousMonthReviews != null && p.previousMonthReviews > 0);

function SimpleBarChart({
  label,
  current,
  previous,
  max,
  unit,
  color,
  eliteT,
}: {
  label: string;
  current: number;
  previous: number;
  max: number;
  unit: string;
  color: string;
  eliteT: EliteMonthlyPdfT;
}) {
  const scale = max > 0 ? 100 / max : 0;
  const prevW = Math.min(100, previous * scale);
  const currW = Math.min(100, current * scale);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 9, color: REPUTEXA_PDF.muted, marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 60, flexShrink: 0 }}>
            <Text style={{ fontSize: 9, color: REPUTEXA_PDF.slate400 }}>
              {eliteT('barPrev')} {previous.toFixed(1)}
              {unit}
            </Text>
          </View>
          <View style={{ flex: 1, height: 6, backgroundColor: REPUTEXA_PDF.border, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ width: `${prevW}%`, height: '100%', backgroundColor: REPUTEXA_PDF.slate400, borderRadius: 2 }} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <View style={{ width: 60, flexShrink: 0 }}>
          <Text style={{ fontSize: 9, fontWeight: 700, color }}>
            {eliteT('barCurrent')} {current.toFixed(1)}
            {unit}
          </Text>
        </View>
        <View style={{ flex: 1, height: 8, backgroundColor: REPUTEXA_PDF.border, borderRadius: 2, overflow: 'hidden' }}>
          <View style={{ width: `${currW}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
        </View>
      </View>
    </View>
  );
}

export function EliteReportTemplate(props: EliteReportProps) {
  const {
    eliteT,
    establishmentName,
    monthLabel,
    averageRating,
    totalReviews,
    positiveCount,
    platforms,
    summaryStats,
    previousMonthRating,
    previousMonthReviews,
    groupComparison = [],
    sentinelFooter,
  } = props;
  const isMultiEstablishment = groupComparison.length > 1;
  const coverTitle = isMultiEstablishment ? eliteT('coverTitleGroup') : establishmentName;

  const zen = summaryStats as {
    tactics?: string[];
    actionPlan?: string[];
    predictive?: string;
    benchmark?: string;
    nextMonthAdvice?: string;
    sentiment?: { love?: string[]; hate?: string[] };
  };
  const showTacticsPage =
    (Array.isArray(zen.tactics) && zen.tactics.length > 0) ||
    (Array.isArray(zen.actionPlan) && zen.actionPlan.length > 0) ||
    (typeof zen.predictive === 'string' && zen.predictive.trim().length > 0) ||
    (typeof zen.benchmark === 'string' && zen.benchmark.trim().length > 0) ||
    (typeof zen.nextMonthAdvice === 'string' && zen.nextMonthAdvice.trim().length > 0);
  const totalPages = showTacticsPage ? 3 : 2;

  return (
    <Document>
      {/* Page de garde */}
      <Page size="A4" style={[styles.page, styles.cover]}>
        <Text style={styles.coverTitle}>{eliteT('coverBrand')}</Text>
        <Text style={styles.coverSubtitle}>{eliteT('coverSubtitle')}</Text>
        <Text style={styles.coverEstablishment}>{coverTitle}</Text>
        {isMultiEstablishment && (
          <Text style={[styles.coverPeriod, { marginTop: 12 }]}>
            {groupComparison.map((e) => e.name).join(' · ')}
          </Text>
        )}
        <Text style={styles.coverPeriod}>{monthLabel}</Text>
        <SentinelReactPdfFooter
          generatedLine={sentinelFooter.generatedLine}
          integrityLine={sentinelFooter.integrityLine}
          pageLine={eliteT('footerStrategic', { monthLabel, page: 1, totalPages })}
          onDarkBackground
          bottom={32}
        />
      </Page>

      {/* Édito + Vue d'ensemble */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>{eliteT('sectionOverview')}</Text>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{eliteT('statAvgRating')}</Text>
            <Text style={styles.statValue}>
              {Number.isFinite(averageRating) && averageRating > 0
                ? `${averageRating.toFixed(1)}/5`
                : eliteT('ratingEmpty')}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{eliteT('statTotalReviews')}</Text>
            <Text style={styles.statValue}>{totalReviews}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{eliteT('statPositive')}</Text>
            <Text style={styles.statValue}>{positiveCount}</Text>
          </View>
        </View>
        {hasEvolution(props) && (
          <View style={{ marginBottom: 20, padding: 14, backgroundColor: REPUTEXA_PDF.rowAlt, borderRadius: 8, borderWidth: 1, borderColor: REPUTEXA_PDF.border }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: REPUTEXA_PDF.ink, marginBottom: 10 }}>{eliteT('evolutionTitle')}</Text>
            {previousMonthRating != null && (
              <SimpleBarChart
                label={eliteT('chartAvgRating')}
                current={averageRating}
                previous={previousMonthRating}
                max={5}
                unit="/5"
                color="#2563eb"
                eliteT={eliteT}
              />
            )}
            {previousMonthReviews != null && (
              <SimpleBarChart
                label={eliteT('chartVolume')}
                current={totalReviews}
                previous={previousMonthReviews}
                max={Math.max(totalReviews, previousMonthReviews) * 1.2 || 50}
                unit={eliteT('unitReviews')}
                color="#0ea5e9"
                eliteT={eliteT}
              />
            )}
          </View>
        )}
        {platforms.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: 600, marginBottom: 6 }}>{eliteT('platformSection')}</Text>
            {platforms.map((p) => (
              <Text key={p.name} style={styles.listItem}>
                {eliteT('platformLine', { name: p.name, count: p.count })}
              </Text>
            ))}
          </View>
        )}

        {isMultiEstablishment && groupComparison.length > 0 && (
          <View style={{ marginBottom: 20, padding: 14, backgroundColor: REPUTEXA_PDF.rowAlt, borderRadius: 8, borderWidth: 1, borderColor: REPUTEXA_PDF.border }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: REPUTEXA_PDF.ink, marginBottom: 10 }}>{eliteT('groupComparisonTitle')}</Text>
            {[...groupComparison].sort((a, b) => b.avgRating - a.avgRating).map((e, i) => (
              <Text key={e.name} style={styles.listItem}>
                {eliteT('groupLine', {
                  trophy: i === 0 ? '🏆 ' : '',
                  name: e.name,
                  avg: e.avgRating.toFixed(1),
                  total: e.totalReviews,
                })}
              </Text>
            ))}
          </View>
        )}

        {!('tactics' in summaryStats) && (
          <Text style={{ fontSize: 9, color: REPUTEXA_PDF.muted, marginBottom: 10 }}>{eliteT('visionDisclaimer')}</Text>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{eliteT('sectionInsights')}</Text>
        <View style={styles.editorial}>
          <View style={styles.insightBlock}>
            <Text style={styles.insightTitle}>{eliteT('insightStrength')}</Text>
            <Text style={styles.insightText}>{summaryStats.strength}</Text>
          </View>
          <View style={styles.insightBlock}>
            <Text style={styles.insightTitle}>{eliteT('insightOpportunity')}</Text>
            <Text style={styles.insightText}>{summaryStats.opportunity}</Text>
          </View>
        </View>

        {'kpis' in summaryStats && Array.isArray(summaryStats.kpis) && summaryStats.kpis.length > 0 && (
          <View>
            <Text style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{eliteT('kpisTitle')}</Text>
            {summaryStats.kpis.map((k, i) => (
              <Text key={i} style={styles.listItem}>
                {k}
              </Text>
            ))}
          </View>
        )}

        {'sentiment' in summaryStats && zen.sentiment && (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.sectionTitle}>{eliteT('sentimentSection')}</Text>
            {(zen.sentiment.love ?? []).length > 0 && (
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.insightTitle, { color: '#047857' }]}>{eliteT('sentimentLove')}</Text>
                {(zen.sentiment.love ?? []).map((line, i) => (
                  <Text key={`love-${i}`} style={styles.listItem}>
                    • {line}
                  </Text>
                ))}
              </View>
            )}
            {(zen.sentiment.hate ?? []).length > 0 && (
              <View>
                <Text style={[styles.insightTitle, { color: '#b45309' }]}>{eliteT('sentimentHate')}</Text>
                {(zen.sentiment.hate ?? []).map((line, i) => (
                  <Text key={`hate-${i}`} style={styles.listItem}>
                    • {line}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        <SentinelReactPdfFooter
          generatedLine={sentinelFooter.generatedLine}
          integrityLine={sentinelFooter.integrityLine}
          pageLine={eliteT('footerConfidential', { monthLabel, page: 2, totalPages })}
          bottom={26}
        />
      </Page>

      {/* Tactiques / Plan d'action / Audit (PULSE / ZENITH) */}
      {showTacticsPage ? (
        <Page size="A4" style={styles.page}>
          {(Array.isArray(zen.actionPlan) && zen.actionPlan.length > 0) ||
          (Array.isArray(zen.tactics) && zen.tactics.length > 0) ? (
            <>
              <Text style={styles.sectionTitle}>
                {Array.isArray(zen.actionPlan) && zen.actionPlan.length > 0
                  ? eliteT('sectionActionOrTactics')
                  : eliteT('sectionTacticsOnly')}
              </Text>
              {(zen.actionPlan?.length ? zen.actionPlan : zen.tactics ?? []).map((item: string, i: number) => (
                <View key={i} style={[styles.insightBlock, { borderLeftColor: '#0ea5e9' }]}>
                  <Text style={styles.insightTitle}>{eliteT('stepLabel', { n: i + 1 })}</Text>
                  <Text style={styles.insightText}>{item}</Text>
                </View>
              ))}
            </>
          ) : null}

          {'predictive' in summaryStats && summaryStats.predictive && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>{eliteT('sectionPredictive')}</Text>
              <Text style={styles.insightText}>{summaryStats.predictive}</Text>
            </View>
          )}

          {'benchmark' in summaryStats && summaryStats.benchmark && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionTitle}>{eliteT('sectionBenchmark')}</Text>
              <Text style={styles.insightText}>{summaryStats.benchmark}</Text>
            </View>
          )}

          {'nextMonthAdvice' in summaryStats && (summaryStats as { nextMonthAdvice?: string }).nextMonthAdvice && (
            <View style={{ marginTop: 20, padding: 14, borderLeftWidth: 4, borderLeftColor: '#10b981', backgroundColor: '#ecfdf5', borderRadius: 8 }}>
              <Text style={[styles.sectionTitle, { borderBottomWidth: 0, marginBottom: 8 }]}>{eliteT('nextMonthTitle')}</Text>
              <Text style={styles.insightText}>{(summaryStats as { nextMonthAdvice?: string }).nextMonthAdvice}</Text>
            </View>
          )}

          <SentinelReactPdfFooter
            generatedLine={sentinelFooter.generatedLine}
            integrityLine={sentinelFooter.integrityLine}
            pageLine={eliteT('footerEstablishment', {
              establishmentName,
              monthLabel,
              page: 3,
              totalPages,
            })}
            bottom={26}
          />
        </Page>
      ) : null}
    </Document>
  );
}
