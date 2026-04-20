import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ReportTranslations } from '@/lib/i18n-server';
import { REPUTEXA_PDF } from '@/lib/pdf/reputexa-react-pdf-tokens';

/** Token in `Report.reviewsCount` — module const avoids i18next/no-literal-string on `.replace`. */
const REVIEWS_COUNT_PLACEHOLDER = '{count}';

type MonthlyReportProps = {
  translations: ReportTranslations;
  establishmentName: string;
  monthLabel: string;
  averageRating: number;
  totalReviews: number;
  positiveCount: number;
  negativeCount: number;
  platforms?: { name: string; count: number }[];
  insights?: { problem: string; solution: string; impact: string }[];
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    paddingTop: 32,
    paddingHorizontal: 32,
    color: REPUTEXA_PDF.ink,
    backgroundColor: REPUTEXA_PDF.pageBg,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: REPUTEXA_PDF.border,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: REPUTEXA_PDF.slate800,
  },
  subtitle: {
    fontSize: 11,
    color: REPUTEXA_PDF.muted,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8,
    color: REPUTEXA_PDF.ink,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  card: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: REPUTEXA_PDF.cardBg,
    borderWidth: 1,
    borderColor: REPUTEXA_PDF.border,
  },
  cardLabel: {
    fontSize: 9,
    color: REPUTEXA_PDF.muted,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: 700,
    color: REPUTEXA_PDF.slate800,
  },
  smallText: {
    fontSize: 9,
    color: REPUTEXA_PDF.muted,
  },
  listItem: {
    fontSize: 10,
    color: REPUTEXA_PDF.slate800,
    marginBottom: 4,
  },
  insightBlock: {
    borderRadius: 8,
    padding: 10,
    backgroundColor: REPUTEXA_PDF.cardBg,
    borderWidth: 1,
    borderColor: REPUTEXA_PDF.border,
    marginBottom: 8,
  },
});

export function MonthlyReportTemplate(props: MonthlyReportProps) {
  const {
    translations: T,
    establishmentName,
    monthLabel,
    averageRating,
    totalReviews,
    positiveCount,
    negativeCount,
    platforms = [],
    insights = [],
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{T.title}</Text>
          <Text style={styles.subtitle}>
            {establishmentName} · {T.period} : {monthLabel}
          </Text>
        </View>

        <View>
          <Text style={styles.sectionTitle}>{T.overview}</Text>
          <View style={styles.row}>
            <View style={[styles.card, { marginRight: 8 }]}>
              <Text style={styles.cardLabel}>{T.avgRating}</Text>
              <Text style={styles.cardValue}>
                {Number.isFinite(averageRating) && averageRating > 0
                  ? `${averageRating.toFixed(1)}/5`
                  : '—'}
              </Text>
            </View>
            <View style={[styles.card, { marginLeft: 8 }]}>
              <Text style={styles.cardLabel}>{T.totalReviews}</Text>
              <Text style={styles.cardValue}>{totalReviews}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.card, { marginRight: 8 }]}>
              <Text style={styles.cardLabel}>{T.positiveReviews}</Text>
              <Text style={styles.cardValue}>{positiveCount}</Text>
            </View>
            <View style={[styles.card, { marginLeft: 8 }]}>
              <Text style={styles.cardLabel}>{T.negativeReviews}</Text>
              <Text style={styles.cardValue}>{negativeCount}</Text>
            </View>
          </View>
        </View>
      </Page>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{T.performance}</Text>
          <Text style={styles.subtitle}>{T.performanceSubtitle}</Text>
        </View>

        <View>
          <Text style={styles.sectionTitle}>{T.platformVolume}</Text>
          {platforms.length === 0 ? (
            <Text style={styles.smallText}>
              {T.noData}
            </Text>
          ) : (
            <View>
              {platforms.map((p) => (
                <Text key={p.name} style={styles.listItem}>
                  • {p.name} : {T.reviewsCount.replace(REVIEWS_COUNT_PLACEHOLDER, String(p.count))}
                </Text>
              ))}
            </View>
          )}
        </View>
      </Page>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{T.roadmapTitle}</Text>
          <Text style={styles.subtitle}>
            {T.roadmapSubtitle}
          </Text>
        </View>
        {insights.length === 0 ? (
          <View>
            <Text style={styles.smallText}>
              {T.insufficientData}
            </Text>
          </View>
        ) : (
          <View>
            {insights.map((i, index) => (
              <View
                key={`${i.problem}-${index}`}
                style={[
                  styles.insightBlock,
                  { borderLeftWidth: 4, borderLeftColor: index === 0 ? '#0ea5e9' : index === 1 ? '#a855f7' : '#f97316' },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  {T.problemDetected}
                </Text>
                <Text style={{ fontSize: 10, marginBottom: 6 }}>{i.problem}</Text>
                <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  {T.solutionReputexa}
                </Text>
                <Text style={{ fontSize: 10, marginBottom: 6 }}>{i.solution}</Text>
                <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  {T.expectedImpact}
                </Text>
                <Text style={{ fontSize: 10 }}>{i.impact}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

