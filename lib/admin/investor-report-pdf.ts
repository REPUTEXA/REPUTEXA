/**
 * Génération PDF « REPUTEXA Investor Report » (navigateur uniquement).
 * Capture html2canvas pour les zones data-investor-export ; texte juridique & méthodo dense, sans pages blanches artificielles.
 */

import type { InvestorMetricsPayload } from '@/lib/admin/investor-metrics';
import {
  buildExecutiveSummaryNarrative,
  executiveSummaryFootnote,
} from '@/lib/admin/investor-executive-projection';
import { luxuryDrawCover, luxurySectionBand, luxuryStampSentinelFooters } from '@/lib/pdf/reputexa-jspdf-luxury';
import { pdfPayloadIntegritySha256Hex } from '@/lib/pdf/sentinel-pdf-integrity';

export const INVESTOR_EXPORT_SELECTORS = {
  liveCash: '[data-investor-export="live-cash"]',
  burnChart: '[data-investor-export="burn-chart"]',
  cohortChart: '[data-investor-export="cohort-chart"]',
  planPie: '[data-investor-export="plan-pie"]',
} as const;

const NAVY: [number, number, number] = [11, 18, 32];
const MUTED: [number, number, number] = [100, 100, 110];

/** ~A4 content width at 14mm margins */
const TEXT_MAX_MM = 182;
const M = 14;
const PAGE_TEXT_FLOOR = 22;
const PAGE_TEXT_CEIL = 282;
const LINE_TIGHT = 4.9;
const LINE_STD = 5.3;

function drawCoverInvestor(pdf: import('jspdf').jsPDF, generatedAt: string): void {
  const dt = new Date(generatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'medium' });
  luxuryDrawCover(pdf, {
    kicker: 'Investor intelligence',
    title: 'REPUTEXA',
    subtitle: 'Investor Report — Data room',
    metaLines: [`Instantané métriques : ${dt}`],
    bodyBlurb:
      'Document interne — non audité — destiné aux data-rooms, diligences investisseurs et pairs sociaux sous NDA. Agrégats Stripe temps réel (solde, MRR, facturation), lecture burn vs growth, cohortes profils hors administrateurs, mix produit Vision / Pulse / Zenith. Ne constitue pas un prospectus ni une attestation comptable.\n\nNiveau de confidentialité : STRICTEMENT CONFIDENTIEL — usage interne et parties contractuellement liées.',
    accent: 'gold',
  });
}

/** Écrit des lignes avec passage automatique à la page suivante (évite blocs vides en fin de page). */
function writeLines(
  pdf: import('jspdf').jsPDF,
  lines: string[],
  y: number,
  lineHeight: number,
  allowBreak = true
): number {
  let ly = y;
  for (const line of lines) {
    if (allowBreak && ly + lineHeight > PAGE_TEXT_CEIL) {
      pdf.addPage();
      ly = PAGE_TEXT_FLOOR;
    }
    pdf.text(line, M, ly);
    ly += lineHeight;
  }
  return ly;
}

function writeSizedParagraphs(
  pdf: import('jspdf').jsPDF,
  chunks: string[],
  y: number,
  lineHeight: number,
  fontSize: number
): number {
  pdf.setFontSize(fontSize);
  let ly = y;
  for (const chunk of chunks) {
    const parts = pdf.splitTextToSize(chunk, TEXT_MAX_MM);
    ly = writeLines(pdf, parts, ly, lineHeight);
    ly += 3;
  }
  return ly;
}

async function capturePng(selector: string): Promise<string | null> {
  const html2canvas = (await import('html2canvas')).default;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#09090b',
    logging: false,
    useCORS: true,
  });
  return canvas.toDataURL('image/png');
}

function addImageFit(pdf: import('jspdf').jsPDF, dataUrl: string, y: number, maxHeightMm: number): number {
  const pageW = pdf.internal.pageSize.getWidth();
  const imgW = pageW - 2 * M;
  const props = pdf.getImageProperties(dataUrl);
  const ratio = props.height / props.width;
  const imgH = Math.min(maxHeightMm, imgW * ratio);
  const pageH = pdf.internal.pageSize.getHeight();
  if (y + imgH > pageH - 20) {
    pdf.addPage();
    y = PAGE_TEXT_FLOOR;
  }
  pdf.addImage(dataUrl, 'PNG', M, y, imgW, imgH);
  return y + imgH + 6;
}

async function buildPdfPages(metrics: InvestorMetricsPayload): Promise<import('jspdf').jsPDF> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

  const euro = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  drawCoverInvestor(pdf, metrics.generatedAt);

  pdf.addPage();
  let ly = luxurySectionBand(pdf, 'Contexte ARR (indicatif)', 22);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const execLines = pdf.splitTextToSize(buildExecutiveSummaryNarrative(metrics.executiveProjection), TEXT_MAX_MM);
  ly = writeLines(pdf, execLines, ly, LINE_STD);

  ly += 4;
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  const footLines = pdf.splitTextToSize(executiveSummaryFootnote(metrics.executiveProjection), TEXT_MAX_MM);
  ly = writeLines(pdf, footLines, ly, LINE_TIGHT);
  pdf.setTextColor(0, 0, 0);

  ly += 6;
  ly = luxurySectionBand(pdf, 'Synthèse chiffrée (Stripe & coûts variables)', ly);
  pdf.setFontSize(10);
  const summaryLines = [
    `Trésorerie Stripe (disponible + en attente) : ${euro(metrics.stripe.totalCashEur)}`,
    `  · disponible : ${euro(metrics.stripe.availableEur)} · en attente : ${euro(metrics.stripe.pendingEur)}`,
    `MRR estimé (abonnements actifs + trialing) : ${euro(metrics.stripe.mrrEur)}`,
    `ARR dérivé (MRR × 12, indicatif) : ${euro(metrics.stripe.mrrEur * 12)}`,
    `Abonnements pris en compte : ${metrics.stripe.activeSubscriptions}`,
    ...(metrics.saasKpis
      ? [
          `Churn logo 30j (approx., non audité) : ${
            metrics.saasKpis.logoChurnMonthlyPct != null
              ? `${metrics.saasKpis.logoChurnMonthlyPct.toFixed(2)}%`
              : 'N/A'
          }`,
          `ARPU : ${metrics.saasKpis.arpuEur != null ? euro(metrics.saasKpis.arpuEur) : 'N/A'}`,
          `LTV indicatif : ${metrics.saasKpis.estimatedLtvEur != null ? euro(metrics.saasKpis.estimatedLtvEur) : 'N/A'}`,
          `CPA 30j : ${
            metrics.saasKpis.cpaEur != null ? euro(metrics.saasKpis.cpaEur) : 'N/A (budget marketing ou inscriptions)'
          }`,
          `Nouveaux profils marchands 30j : ${metrics.saasKpis.newMerchantProfilesLast30d}`,
        ]
      : []),
    `Burn ops mois courant (OpenAI + estimation envoi mails) : ${euro(metrics.burnOps.totalEurMonth)}`,
    `  · OpenAI (API organization/costs ou repli env) : ${metrics.burnOps.openaiEurMonth != null ? euro(metrics.burnOps.openaiEurMonth) : 'N/A'}`,
    `  · Resend (INVESTOR_RESEND_MONTHLY_EUR) : ${euro(metrics.burnOps.resendEurMonth)}`,
  ];
  ly = writeLines(pdf, summaryLines, ly, LINE_STD);
  if (metrics.burnOps.openaiError) {
    ly += 2;
    pdf.setTextColor(160, 80, 0);
    pdf.setFont('helvetica', 'italic');
    const warn = pdf.splitTextToSize(
      `Lecture OpenAI coûts : ${metrics.burnOps.openaiError}. Vérifier une clé API avec droits « Admin » organisation ou renseigner INVESTOR_OPENAI_MONTHLY_FALLBACK_EUR pour un montant de repli prudent.`,
      TEXT_MAX_MM
    );
    ly = writeLines(pdf, warn, ly, LINE_TIGHT);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
  }

  if (metrics.unitEconomics) {
    const t = metrics.unitEconomics.totals;
    ly += 4;
    const ueLines = [
      'Abonnements Stripe (hors ventilation comptable détaillée) :',
      `  · MRR moyen par abo : ${euro(t.avgMrrPerSubEur)}`,
      `  · statuts : ${t.activeCount} actif(s), ${t.trialingCount} essai — ${t.unmatchedStripeSubs} abonnement(s) sans fiche profil reliée (voir rapprochement dans l’outil admin)`,
      `  · charges techniques agrégées du mois (OpenAI + estimation envoi mails) : ${euro(t.variableCostsEur)} — indicateur global, pas un coût exact par client dans ce rapport`,
    ];
    ly = writeLines(pdf, ueLines, ly, LINE_STD);
  }

  const snap = async (title: string, selector: string) => {
    const img = await capturePng(selector);
    pdf.addPage();
    luxurySectionBand(pdf, title, 22);
    if (img) {
      addImageFit(pdf, img, 34, 102);
    } else {
      pdf.setFontSize(10);
      pdf.setTextColor(160, 0, 0);
      pdf.text('Capture indisponible (élément absent du DOM). Rafraîchir l’écran admin avant export.', M, 40);
      pdf.setTextColor(0, 0, 0);
    }
  };

  await snap('Live Cash · Stripe', INVESTOR_EXPORT_SELECTORS.liveCash);
  await snap('Burn vs Growth', INVESTOR_EXPORT_SELECTORS.burnChart);
  await snap('Cohortes (profils hors admin)', INVESTOR_EXPORT_SELECTORS.cohortChart);
  await snap('Répartition par plan', INVESTOR_EXPORT_SELECTORS.planPie);

  pdf.addPage();
  ly = luxurySectionBand(pdf, 'Coûts variables & méthodologie Stripe', 22);
  const methodChunks = [
    'Coûts OpenAI : agrégation de l’endpoint /v1/organization/costs (fenêtre mois civil UTC courant). La clé API doit disposer des droits d’administration sur l’organisation ; défaut HTTP 403 sinon. Conversion USD→EUR : INVESTOR_FX_USD_EUR (défaut 0,92). En l’absence de réponse exploitable, utilisez INVESTOR_OPENAI_MONTHLY_FALLBACK_EUR pour documenter une charge estimée dans le data-room.',
    'Resend : pas d’API publique de facturation consolidée — budget mensuel indicatif via INVESTOR_RESEND_MONTHLY_EUR.',
    'Trésorerie Stripe : balance.retrieve() — somme des soldes disponibles et en attente, convertis en EUR.',
    'MRR : somme des abonnements « active » et « trialing », normalisés en mensuel (facturation annuelle ÷ 12).',
    'Courbe « Growth » : factures payées agrégées par mois civil UTC ; « Burn » (k€) réplique le burn du mois courant sur l’historique pour comparabilité visuelle avec le chiffre d’affaires encaissé — lecture prudente, non substitut d’un tableau de trésorerie réel.',
    'Mix plans : mapping des price IDs Stripe vers Vision / Pulse / Zenith selon configuration applicative.',
  ];
  ly = writeSizedParagraphs(pdf, methodChunks, ly, LINE_STD, 10);

  pdf.addPage();
  ly = luxurySectionBand(pdf, 'Compliance & Data Safety', 22);
  const complianceBlocks = [
    'REPUTEXA maintient un Registre des traitements aligné sur l’article 30 du RGPD (export CSV pour autorités et partenaires diligents), des politiques de confidentialité versionnées, une traçabilité des consentements produit et un journal legal_compliance_logs horodaté.',
    'Les administrateurs disposent d’un Centre de Conformité (exports audit bundle, attestations, affiches) : posture « Audit-Ready » — dossier structuré, preuves exportables, documentation RGPD générable avec un flux d’actions minimal.',
    'Le présent rapport cite ce dispositif pour montrer que la gouvernance des données est intégrée au produit et traçable pour une diligence réglementaire (sous réserve du secret professionnel et du périmètre NDA).',
  ];
  pdf.setFontSize(10);
  for (const block of complianceBlocks) {
    const split = pdf.splitTextToSize(block, TEXT_MAX_MM);
    ly = writeLines(pdf, split, ly, LINE_STD);
    ly += 4;
  }
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...NAVY);
  ly = writeLines(pdf, ['Positionnement data-room : référentiel prêt pour diligence — sous réserve de validation juridique externe.'], ly, LINE_STD);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  ly += 2;
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  const auditLine = pdf.splitTextToSize(
    'Réf. registre public : /docs/registre-traitements-art30-reputexa.csv — à rapprocher des exports juridiques et des certificats générés depuis l’espace client.',
    TEXT_MAX_MM
  );
  writeLines(pdf, auditLine, ly, LINE_TIGHT);

  pdf.addPage();
  ly = luxurySectionBand(pdf, 'Limites, interprétation & confidentialité', 22);
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  const legalChunks = [
    'Ce rapport est généré automatiquement : il ne remplace ni une diligence comptable, ni un audit fiscal, ni un avis juridique. Les destinataires demeurent seuls responsables de son usage externe.',
    'Les cohortes s’appuient sur le champ subscription_status en base applicative (pas sur l’historique Stripe transaction par transaction).',
    'Les formulations sur l’horizon ARR relèvent d’un contexte data-room indicatif — validation obligatoire par les fonctions Finance / FP&A / Juridique avant communication hors cercle restreint.',
    'Distribution réservée aux personnes habilitées sous NDA ; reproduction interdite sans accord écrit. REPUTEXA — Tous droits réservés.',
  ];
  ly = writeSizedParagraphs(pdf, legalChunks, ly, LINE_STD, 10);

  return pdf;
}

export async function buildInvestorReportPdfBlob(metrics: InvestorMetricsPayload): Promise<Blob> {
  const integritySha256Hex = await pdfPayloadIntegritySha256Hex({
    kind: 'investor-report',
    v: 1,
    metrics,
  });
  const generatedAt = new Date();
  const pdf = await buildPdfPages(metrics);
  luxuryStampSentinelFooters(pdf, {
    scopeLineWithPage: 'REPUTEXA · Confidentiel · {n}',
    generatedAt,
    integritySha256Hex,
    accent: 'gold',
  });
  return pdf.output('blob');
}

export async function downloadInvestorReportPdf(metrics: InvestorMetricsPayload): Promise<void> {
  const blob = await buildInvestorReportPdfBlob(metrics);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `REPUTEXA-Investor-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** @deprecated préférer downloadInvestorReportPdf — alias conservé pour appels existants */
export async function generateReputexaInvestorReportPdf(metrics: InvestorMetricsPayload): Promise<void> {
  await downloadInvestorReportPdf(metrics);
}
