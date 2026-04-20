/**
 * PDF « Dossier conformité » mensuel (admin) : registre structuré (tableau Art.30),
 * CSV sous-traitants, gabarit emplacements, journal + archives fiche opérateur, signature.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { jsPDF } from 'jspdf';
import { createTranslator } from 'next-intl';

import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import {
  OPERATOR_CHECKLIST_IDS,
  type OperatorChecklistStored,
} from '@/lib/admin/admin-operator-checklist';
import { parseRegistreRgpdHtml } from '@/lib/pdf/parse-registre-rgpd-html';
import {
  LUX,
  luxuryDrawCover,
  luxuryDrawLogCard,
  luxuryDrawMonospaceBlock,
  luxuryDrawRegistreTreatment,
  luxuryEnsureY,
  luxurySectionBand,
  luxuryStampSentinelFooters,
} from '@/lib/pdf/reputexa-jspdf-luxury';
import { pdfPayloadIntegritySha256Hex } from '@/lib/pdf/sentinel-pdf-integrity';

function intlLocaleForPdf(siteLocale: string): string {
  const m: Record<string, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
    ja: 'ja-JP',
    zh: 'zh-CN',
  };
  return m[siteLocale] ?? 'fr-FR';
}

export function parseMonthYearParam(raw: string | null): { year: number; month: number } {
  const now = new Date();
  const y0 = now.getFullYear();
  const m0 = now.getMonth() + 1;
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return { year: y0, month: m0 };
  const [ys, ms] = raw.split('-');
  const year = Number(ys);
  const month = Number(ms);
  if (!Number.isFinite(year) || month < 1 || month > 12) return { year: y0, month: m0 };
  return { year, month };
}

export function monthRangeUtcIso(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
  return { start, end };
}

function htmlToPlainText(html: string): string {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  t = t.replace(/<style[\s\S]*?<\/style>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/(p|div|h[1-6]|li|tr|section|header|footer|table|thead|tbody)>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');
  t = t
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.replace(/\r/g, '').trim();
}

function readPublicUtf8(
  tr: ReturnType<typeof createTranslator>,
  ...segments: string[]
): string {
  const p = join(process.cwd(), 'public', ...segments);
  if (!existsSync(p)) return tr('fileNotFound', { path: segments.join('/') });
  return readFileSync(p, 'utf8');
}

function writeLines(pdf: jsPDF, lines: string[], y: number, lineHeight: number): number {
  let ly = y;
  for (const line of lines) {
    if (ly + lineHeight > LUX.PAGE_BOTTOM) {
      pdf.addPage();
      ly = LUX.PAGE_TOP;
    }
    pdf.text(line, LUX.M, ly);
    ly += lineHeight;
  }
  return ly;
}

function kindLabel(tr: ReturnType<typeof createTranslator>, kind: string): string {
  const keys: Record<string, string> = {
    check: 'kind_check',
    uncheck: 'kind_uncheck',
    reset_daily: 'kind_reset_daily',
    reset_weekly: 'kind_reset_weekly',
    reset_monthly: 'kind_reset_monthly',
    archive_snapshot: 'kind_archive_snapshot',
  };
  const k = keys[kind];
  return k ? tr(k) : kind;
}

export async function buildComplianceBundlePdf(params: {
  year: number;
  month: number;
  signedBy: string | null;
  operator: OperatorChecklistStored;
}): Promise<jsPDF> {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin.complianceBundlePdf' });
  const intlLoc = intlLocaleForPdf(locale);

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const { start, end } = monthRangeUtcIso(params.year, params.month);
  const generatedAt = new Date();
  const integritySha256Hex = await pdfPayloadIntegritySha256Hex({
    kind: 'compliance-bundle',
    v: 1,
    year: params.year,
    month: params.month,
    signedBy: params.signedBy,
    operator: params.operator,
  });
  const gen = generatedAt.toLocaleString(intlLoc, { dateStyle: 'long', timeStyle: 'short' });
  const metaLines = [
    t('metaGenerated', { date: gen }),
    ...(params.signedBy ? [t('metaSignedBy', { name: params.signedBy })] : []),
  ];

  luxuryDrawCover(pdf, {
    kicker: t('coverKicker'),
    title: t('coverTitle'),
    subtitle: t('coverSubtitle', {
      month: String(params.month).padStart(2, '0'),
      year: params.year,
    }),
    metaLines,
    bodyBlurb: t('coverBody'),
    accent: 'blue',
  });

  const csvRel = readPublicUtf8(t, 'docs', 'compliance-audit-kit', 'liste-sous-traitants.csv');
  const registerHtml = readPublicUtf8(t, 'docs', 'registre-rgpd-reputexa.html');
  const registerSections = parseRegistreRgpdHtml(registerHtml);

  pdf.addPage();
  let ly = luxurySectionBand(
    pdf,
    '1. Liste sous-traitants (fichier public au moment de la génération)',
    LUX.PAGE_TOP
  );
  ly = luxuryDrawMonospaceBlock(pdf, ly, csvRel, 12000);

  pdf.addPage();
  ly = luxurySectionBand(pdf, t('section2Title'), LUX.PAGE_TOP);
  const logsTemplate = readPublicUtf8(t, 'docs', 'compliance-audit-kit', 'emplacements-logs.md');
  ly = luxuryDrawMonospaceBlock(pdf, ly, logsTemplate, 8000);

  pdf.addPage();
  ly = luxurySectionBand(pdf, t('section3Title'), LUX.PAGE_TOP);
  pdf.setFontSize(8.5);
  pdf.setTextColor(...LUX.MUTED);
  const regIntro = pdf.splitTextToSize(t('regIntro'), LUX.TEXT_MAX);
  for (const line of regIntro) {
    ly = luxuryEnsureY(pdf, ly, LUX.LINE_STD + 2);
    pdf.text(line, LUX.M, ly);
    ly += LUX.LINE_STD;
  }
  pdf.setTextColor(0, 0, 0);

  if (registerSections.length === 0) {
    ly += 2;
    ly = luxuryDrawMonospaceBlock(
      pdf,
      ly,
      `${t('registerParseFallback')}\n\n${htmlToPlainText(registerHtml)}`,
      18_000
    );
  } else {
    registerSections.forEach((section, i) => luxuryDrawRegistreTreatment(pdf, section, i + 1));
  }

  const inMonth = (iso: string) => {
    const t = iso.trim();
    return t >= start && t < end;
  };

  const logFiltered = params.operator.log.filter((e) => inMonth(e.at));
  const snapsFiltered = params.operator.snapshots.filter((s) => inMonth(s.at));

  pdf.addPage();
  ly = luxurySectionBand(
    pdf,
    t('section4Title', {
      period: `${params.year}-${String(params.month).padStart(2, '0')}`,
    }),
    LUX.PAGE_TOP
  );
  if (logFiltered.length === 0) {
    ly = luxuryDrawLogCard(pdf, [t('logEmpty')], ly);
  } else {
    for (const e of logFiltered) {
      const parts = `${new Date(e.at).toLocaleString(intlLoc)} · ${kindLabel(t, e.kind)}${
        e.itemId ? ` · ${e.itemId}` : ''
      }${e.note ? ` · ${e.note}` : ''}${e.summary ? ` · ${e.summary}` : ''}`;
      const wrapped = pdf.splitTextToSize(parts, LUX.TEXT_MAX - 8);
      ly = luxuryDrawLogCard(pdf, wrapped, ly);
    }
  }

  ly += 4;
  ly = luxuryEnsureY(pdf, ly, 28);
  ly = luxurySectionBand(pdf, t('section5Title'), ly);
  if (snapsFiltered.length === 0) {
    ly = luxuryDrawLogCard(pdf, [t('snapshotsEmpty')], ly);
  } else {
    for (const s of snapsFiltered) {
      const line = t('snapshotArchiveLine', {
        date: new Date(s.at).toLocaleString(intlLoc),
        done: s.doneCount,
        total: s.totalSlots,
        note: s.note ?? t('emptyDash'),
      });
      const wrapped = pdf.splitTextToSize(line, LUX.TEXT_MAX - 8);
      ly = luxuryDrawLogCard(pdf, wrapped, ly);
    }
  }

  const checkedNow = OPERATOR_CHECKLIST_IDS.filter((id) => params.operator.checked[id] === true);
  ly += 4;
  ly = luxuryEnsureY(pdf, ly, 28);
  ly = luxurySectionBand(pdf, t('section6Title'), ly);
  pdf.setFontSize(9);
  const stateLine = t('stateLineTasks', {
    done: checkedNow.length,
    total: OPERATOR_CHECKLIST_IDS.length,
  });
  ly = writeLines(pdf, pdf.splitTextToSize(stateLine, LUX.TEXT_MAX), ly, LUX.LINE_TIGHT);
  ly += 1;
  if (checkedNow.length > 0) {
    const idsLine = checkedNow.join(', ');
    ly = writeLines(
      pdf,
      pdf.splitTextToSize(t('idsPrefix', { list: idsLine }), LUX.TEXT_MAX),
      ly,
      LUX.LINE_TIGHT
    );
  }

  ly += 6;
  if (ly > LUX.PAGE_BOTTOM - 40) {
    pdf.addPage();
    ly = LUX.PAGE_TOP;
  }
  ly = luxurySectionBand(pdf, t('section7Title'), ly);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  ly = writeLines(
    pdf,
    [
      t('sigLine1'),
      t('sigLine2'),
      '',
      t('sigNameRole', { name: params.signedBy ?? t('sigNamePlaceholder') }),
      '',
      t('sigSignatureLabel'),
      '',
      t('sigDateLabel'),
    ],
    ly,
    LUX.LINE_STD
  );

  luxuryStampSentinelFooters(pdf, {
    scopeLineWithPage: t('footerScopeLine'),
    generatedAt,
    integritySha256Hex,
    accent: 'blue',
  });
  return pdf;
}
