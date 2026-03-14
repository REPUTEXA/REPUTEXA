/**
 * Template PDF magazine-style — Rapport de Cabinet de Conseil.
 * Page de garde, édito IA, infographies.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SummaryStats } from '@/lib/monthly-reports/types';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    paddingTop: 40,
    paddingHorizontal: 40,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  cover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#ffffff',
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
    color: '#2563eb',
  },
  coverPeriod: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
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
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: '#0f172a',
  },
  insightBlock: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
    backgroundColor: '#f8fafc',
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 10,
    color: '#334155',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 10,
    color: '#334155',
    marginBottom: 6,
    paddingLeft: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

type GroupComparisonItem = { name: string; avgRating: number; totalReviews: number; id?: string };

type EliteReportProps = {
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
}: {
  label: string;
  current: number;
  previous: number;
  max: number;
  unit: string;
  color: string;
}) {
  const scale = max > 0 ? 100 / max : 0;
  const prevW = Math.min(100, previous * scale);
  const currW = Math.min(100, current * scale);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 60, flexShrink: 0 }}>
            <Text style={{ fontSize: 9, color: '#94a3b8' }}>Préc. {previous.toFixed(1)}{unit}</Text>
          </View>
          <View style={{ flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ width: `${prevW}%`, height: '100%', backgroundColor: '#94a3b8', borderRadius: 2 }} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <View style={{ width: 60, flexShrink: 0 }}>
          <Text style={{ fontSize: 9, fontWeight: 700, color }}>Actuel {current.toFixed(1)}{unit}</Text>
        </View>
        <View style={{ flex: 1, height: 8, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
          <View style={{ width: `${currW}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
        </View>
      </View>
    </View>
  );
}

export function EliteReportTemplate(props: EliteReportProps) {
  const { establishmentName, monthLabel, averageRating, totalReviews, positiveCount, platforms, summaryStats, previousMonthRating, previousMonthReviews, groupComparison = [] } = props;
  const isMultiEstablishment = groupComparison.length > 1;
  const coverTitle = isMultiEstablishment ? 'Rapport Groupe' : establishmentName;

  return (
    <Document>
      {/* Page de garde */}
      <Page size="A4" style={[styles.page, styles.cover]}>
        <Text style={styles.coverTitle}>REPUTEXA</Text>
        <Text style={styles.coverSubtitle}>Rapport Stratégique e-réputation</Text>
        <Text style={styles.coverEstablishment}>{coverTitle}</Text>
        {isMultiEstablishment && (
          <Text style={[styles.coverPeriod, { marginTop: 12 }]}>
            {groupComparison.map((e) => e.name).join(' · ')}
          </Text>
        )}
        <Text style={styles.coverPeriod}>{monthLabel}</Text>
      </Page>

      {/* Édito + Vue d'ensemble */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Vue d&apos;ensemble</Text>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Note moyenne</Text>
            <Text style={styles.statValue}>
              {Number.isFinite(averageRating) && averageRating > 0 ? `${averageRating.toFixed(1)}/5` : '—'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total avis</Text>
            <Text style={styles.statValue}>{totalReviews}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Positifs (4–5★)</Text>
            <Text style={styles.statValue}>{positiveCount}</Text>
          </View>
        </View>
        {hasEvolution(props) && (
          <View style={{ marginBottom: 20, padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Évolution</Text>
            {previousMonthRating != null && (
              <SimpleBarChart
                label="Note moyenne"
                current={averageRating}
                previous={previousMonthRating}
                max={5}
                unit="/5"
                color="#2563eb"
              />
            )}
            {previousMonthReviews != null && (
              <SimpleBarChart
                label="Volume d'avis"
                current={totalReviews}
                previous={previousMonthReviews}
                max={Math.max(totalReviews, previousMonthReviews) * 1.2 || 50}
                unit="avis"
                color="#0ea5e9"
              />
            )}
          </View>
        )}
        {platforms.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: 600, marginBottom: 6 }}>Par plateforme</Text>
            {platforms.map((p) => (
              <Text key={p.name} style={styles.listItem}>
                • {p.name} : {p.count} avis
              </Text>
            ))}
          </View>
        )}

        {isMultiEstablishment && groupComparison.length > 0 && (
          <View style={{ marginBottom: 20, padding: 14, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Comparaison du groupe</Text>
            {[...groupComparison].sort((a, b) => b.avgRating - a.avgRating).map((e, i) => (
              <Text key={e.name} style={styles.listItem}>
                {i === 0 ? '🏆 ' : ''}{e.name} : {e.avgRating.toFixed(1)}/5 · {e.totalReviews} avis
              </Text>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Insights stratégiques</Text>
        <View style={styles.editorial}>
          <View style={styles.insightBlock}>
            <Text style={styles.insightTitle}>Point fort</Text>
            <Text style={styles.insightText}>{summaryStats.strength}</Text>
          </View>
          <View style={styles.insightBlock}>
            <Text style={styles.insightTitle}>Opportunité clé</Text>
            <Text style={styles.insightText}>{summaryStats.opportunity}</Text>
          </View>
        </View>

        {'kpis' in summaryStats && Array.isArray(summaryStats.kpis) && summaryStats.kpis.length > 0 && (
          <View>
            <Text style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>KPIs clés</Text>
            {summaryStats.kpis.map((k, i) => (
              <Text key={i} style={styles.listItem}>
                {k}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.footer}>REPUTEXA · Rapport confidentiel · {monthLabel}</Text>
      </Page>

      {/* Tactiques / Plan d'action (PULSE / ZENITH) */}
      {('tactics' in summaryStats && summaryStats.tactics?.length) ||
      ('actionPlan' in summaryStats && (summaryStats as { actionPlan?: string[] }).actionPlan?.length) ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>
            {'actionPlan' in summaryStats ? 'Plan d&apos;action' : 'Tactiques de croissance'}
          </Text>
          {(
            ('actionPlan' in summaryStats && (summaryStats as { actionPlan?: string[] }).actionPlan) ||
            ('tactics' in summaryStats && summaryStats.tactics) ||
            []
          ).map((item: string, i: number) => (
            <View key={i} style={[styles.insightBlock, { borderLeftColor: '#0ea5e9' }]}>
              <Text style={styles.insightTitle}>Étape {i + 1}</Text>
              <Text style={styles.insightText}>{item}</Text>
            </View>
          ))}

          {'predictive' in summaryStats && summaryStats.predictive && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>Analyse prédictive</Text>
              <Text style={styles.insightText}>{summaryStats.predictive}</Text>
            </View>
          )}

          {'benchmark' in summaryStats && summaryStats.benchmark && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionTitle}>Benchmark secteur</Text>
              <Text style={styles.insightText}>{summaryStats.benchmark}</Text>
            </View>
          )}

          {'nextMonthAdvice' in summaryStats && (summaryStats as { nextMonthAdvice?: string }).nextMonthAdvice && (
            <View style={{ marginTop: 20, padding: 14, borderLeftWidth: 4, borderLeftColor: '#10b981', backgroundColor: '#ecfdf5', borderRadius: 8 }}>
              <Text style={[styles.sectionTitle, { borderBottomWidth: 0, marginBottom: 8 }]}>Conseils stratégiques — mois suivant</Text>
              <Text style={styles.insightText}>{(summaryStats as { nextMonthAdvice?: string }).nextMonthAdvice}</Text>
            </View>
          )}

          <Text style={styles.footer}>REPUTEXA · {establishmentName} · {monthLabel}</Text>
        </Page>
      ) : null}
    </Document>
  );
}
