import type { InvestorMetricsPayload } from '@/lib/admin/investor-metrics';
import {
  buildExecutiveSummaryNarrative,
  executiveSummaryFootnote,
} from '@/lib/admin/investor-executive-projection';

const MAX_SUBSCRIBER_LINES = 60;

function formatSubscriberTsv(metrics: InvestorMetricsPayload): string {
  const rows = metrics.unitEconomics?.rows ?? [];
  const lines = rows.slice(0, MAX_SUBSCRIBER_LINES).map(
    (r) =>
      `${r.displayLabel}\t${r.email ?? ''}\t${r.customerEmail ?? ''}\t${r.profileMatch}\t${r.planLabel}\t${r.subscriptionStatus}\t${r.mrrEur}\t${r.stripeSubscriptionId}\t${r.stripeCustomerId}`
  );
  const more = rows.length > MAX_SUBSCRIBER_LINES ? rows.length - MAX_SUBSCRIBER_LINES : 0;
  return [
    'client\temail_profil\temail_stripe\tprofil_match\tplan\tstatut_stripe\tmrr_eur\tsubscription_id\tcustomer_id',
    ...lines,
    more > 0
      ? `… ${more} autres lignes non listées ici (MRR total et totaux inchangés ci-dessus).`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Dossier complet injecté dans le copilot (facturation, cohortes longues, unit economics). */
export function buildInvestorMetricsChatContext(metrics: InvestorMetricsPayload): string {
  const exec = buildExecutiveSummaryNarrative(metrics.executiveProjection);
  const foot = executiveSummaryFootnote(metrics.executiveProjection);
  const plans = metrics.planMix.map((p) => `${p.name}: ${p.count} abos (${p.pct}%)`).join('\n');
  const cohortsChart = metrics.cohorts
    .map((c) => `${c.cohorte}: rétention ${c.rétention}% (${c.retained}/${c.signed} inscrits)`)
    .join('\n');
  const cohortsLong = (metrics.cohortsExtended ?? metrics.cohorts)
    .map((c) => `${c.cohorte}: rétention ${c.rétention}% (${c.retained}/${c.signed})`)
    .join('\n');
  const burnGrowth = metrics.burnVsGrowth
    .map((b) => `${b.m}: encaissements (graph) ${b.growth} k€ vs burn ops ${b.burn} k€`)
    .join('\n');

  const hist = metrics.paidRevenueHistory ?? [];
  const histMeta = metrics.paidRevenueHistoryMeta;
  const histBlock = hist.map((h) => `${h.monthKey} (${h.label}): ${h.paidEur} EUR`).join('\n');

  const u = metrics.unitEconomics?.totals;

  return [
    '=== MÉTADONNÉES ===',
    `Instantané API (ISO): ${metrics.generatedAt}`,
    `Profils marchands chargés (hors admin): ${metrics.nonAdminProfilesLoaded ?? '—'}`,
    '',
    '=== STRIPE — TRÉSORERIE & ABONNEMENTS ===',
    `Trésorerie totale: ${metrics.stripe.totalCashEur} EUR (disp. ${metrics.stripe.availableEur}, attente ${metrics.stripe.pendingEur})`,
    `MRR estimé: ${metrics.stripe.mrrEur} EUR`,
    `Abonnements Stripe actifs+essai comptés: ${metrics.stripe.activeSubscriptions}`,
    '',
    '=== KPIs SAAS (ORDRE DE GRANDEUR) ===',
    metrics.saasKpis
      ? [
          `Churn logo 30j: ${metrics.saasKpis.logoChurnMonthlyPct ?? 'N/A'} %`,
          `ARPU: ${metrics.saasKpis.arpuEur ?? 'N/A'} EUR`,
          `LTV indicatif: ${metrics.saasKpis.estimatedLtvEur ?? 'N/A'} EUR`,
          `CPA 30j: ${metrics.saasKpis.cpaEur ?? 'N/A'} EUR`,
          `Annulations Stripe 30j: ${metrics.saasKpis.canceledSubscriptionsLast30d}`,
          `Nouveaux profils marchands 30j: ${metrics.saasKpis.newMerchantProfilesLast30d}`,
          `Budget marketing mensuel (env): ${metrics.saasKpis.marketingSpendMonthlyEur ?? 'N/A'} EUR`,
        ].join('\n')
      : '—',
    '',
    '=== COÛTS VARIABLES (MOIS COURANT, ESTIMATION) ===',
    `Total OpenAI+Resend: ${metrics.burnOps.totalEurMonth} EUR`,
    `OpenAI: ${metrics.burnOps.openaiEurMonth ?? 'N/A'} EUR`,
    `Resend (budget): ${metrics.burnOps.resendEurMonth} EUR`,
    `Erreur lecture OpenAI si présente: ${metrics.burnOps.openaiError ?? 'aucune'}`,
    '',
    '=== HISTORIQUE ENCAISSEMENTS (FACTURES PAYÉES STRIPE, PAR MOIS UTC) ===',
    histMeta
      ? `Fenêtre demandée: ~${histMeta.horizonMonths} mois · ${histMeta.monthsWithData} mois avec factures · ${histMeta.firstMonthKey ?? '?'} → ${histMeta.lastMonthKey ?? '?'} · somme des lignes: ${histMeta.sumPaidEurInSeries} EUR`
      : '',
    histBlock || '—',
    '',
    '=== SÉRIE GRAPHIQUE BURN VS GROWTH (6 MOIS, K€) ===',
    burnGrowth || '—',
    '',
    '=== MIX PRODUITS ===',
    plans || '—',
    '',
    '=== COHORTES (8 MOIS — COMME LE GRAPHIQUE) ===',
    cohortsChart || '—',
    '',
    '=== COHORTES ÉTENDUES (JUSQU’À 36 MOIS D’INSCRIPTION) ===',
    cohortsLong || '—',
    '',
    '=== ABONNEMENTS STRIPE — AGRÉGATS (DONT RAPPROCHEMENT PROFILS) ===',
    u
      ? [
          `MRR total (lignes abos): ${u.mrrEur} EUR`,
          `MRR moyen par abo: ${u.avgMrrPerSubEur} EUR`,
          `Actifs: ${u.activeCount} · Essais: ${u.trialingCount} · Abos sans profil relié: ${u.unmatchedStripeSubs}`,
          `Coûts variables mois (OpenAI+Resend, agrégat): ${u.variableCostsEur} EUR — reste indicatif, non ventilé par ligne dans l’UI investisseur.`,
        ].join('\n')
      : '—',
    '',
    '=== DÉTAIL ABONNEMENTS (TSV) — jusqu’à ' + MAX_SUBSCRIBER_LINES + ' lignes ===',
    formatSubscriberTsv(metrics),
    '',
    '=== CONTEXTE ARR (TEXTE PDF / DATA-ROOM, INDICATIF) ===',
    exec,
    foot,
  ]
    .filter((line) => line !== '')
    .join('\n');
}
