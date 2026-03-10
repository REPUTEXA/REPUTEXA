import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

type MonthlyReportProps = {
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
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#020617',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8,
    color: '#0f172a',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  card: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#020617',
  },
  smallText: {
    fontSize: 9,
    color: '#64748b',
  },
  listItem: {
    fontSize: 10,
    color: '#020617',
    marginBottom: 4,
  },
  insightBlock: {
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
});

export function MonthlyReportTemplate(props: MonthlyReportProps) {
  const {
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
          <Text style={styles.title}>REPUTEXA — Rapport mensuel</Text>
          <Text style={styles.subtitle}>
            {establishmentName} · Période : {monthLabel}
          </Text>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Vue d&apos;ensemble</Text>
          <View style={styles.row}>
            <View style={[styles.card, { marginRight: 8 }]}>
              <Text style={styles.cardLabel}>Note moyenne</Text>
              <Text style={styles.cardValue}>
                {Number.isFinite(averageRating) && averageRating > 0
                  ? `${averageRating.toFixed(1)}/5`
                  : '—'}
              </Text>
            </View>
            <View style={[styles.card, { marginLeft: 8 }]}>
              <Text style={styles.cardLabel}>Total avis</Text>
              <Text style={styles.cardValue}>{totalReviews}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.card, { marginRight: 8 }]}>
              <Text style={styles.cardLabel}>Avis positifs (4★–5★)</Text>
              <Text style={styles.cardValue}>{positiveCount}</Text>
            </View>
            <View style={[styles.card, { marginLeft: 8 }]}>
              <Text style={styles.cardLabel}>Avis négatifs (1★–3★)</Text>
              <Text style={styles.cardValue}>{negativeCount}</Text>
            </View>
          </View>
        </View>
      </Page>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Performance</Text>
          <Text style={styles.subtitle}>Vue synthétique par plateforme</Text>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Volume d&apos;avis par plateforme</Text>
          {platforms.length === 0 ? (
            <Text style={styles.smallText}>
              Données insuffisantes pour ce mois. Aucun avis n&apos;a été enregistré.
            </Text>
          ) : (
            <View>
              {platforms.map((p) => (
                <Text key={p.name} style={styles.listItem}>
                  • {p.name} : {p.count} avis
                </Text>
              ))}
            </View>
          )}
        </View>
      </Page>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Feuille de route stratégique IA</Text>
          <Text style={styles.subtitle}>
            Analyse des tendances récurrentes et recommandations actionnables
          </Text>
        </View>
        {insights.length === 0 ? (
          <View>
            <Text style={styles.smallText}>
              Données insuffisantes pour générer des recommandations détaillées ce mois-ci, ou
              option non activée pour ce compte.
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
                  Problème détecté
                </Text>
                <Text style={{ fontSize: 10, marginBottom: 6 }}>{i.problem}</Text>
                <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  Solution Reputexa
                </Text>
                <Text style={{ fontSize: 10, marginBottom: 6 }}>{i.solution}</Text>
                <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  Impact attendu
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

