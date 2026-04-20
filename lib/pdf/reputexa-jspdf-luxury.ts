/**
 * Design system jsPDF REPUTEXA — pieds de page, couvertures, tableaux structurés
 * (cohérent avec le dashboard sombre + accents bleu / or).
 */

import type { jsPDF } from 'jspdf';
import type { RegistreTreatmentSection } from '@/lib/pdf/parse-registre-rgpd-html';

export const LUX = {
  M: 14,
  TEXT_MAX: 182,
  PAGE_TOP: 22,
  /** Réserve le bas de page pour le bloc Sentinel (filet + 3 lignes). */
  PAGE_BOTTOM: 262,
  LINE_TIGHT: 4.5,
  LINE_STD: 5.2,
  NAVY: [15, 23, 42] as [number, number, number],
  SLATE900: [15, 23, 42] as [number, number, number],
  BLUE: [37, 99, 235] as [number, number, number],
  GOLD: [196, 163, 68] as [number, number, number],
  MUTED: [100, 116, 139] as [number, number, number],
  BORDER: [226, 232, 240] as [number, number, number],
  ROW_A: [255, 255, 255] as [number, number, number],
  ROW_B: [248, 250, 252] as [number, number, number],
  HEADER_BG: [30, 41, 59] as [number, number, number],
} as const;

export type LuxuryAccent = 'blue' | 'gold';

function accentRgb(accent: LuxuryAccent): [number, number, number] {
  return accent === 'gold' ? LUX.GOLD : LUX.BLUE;
}

export function luxuryStampFooters(pdf: jsPDF, footerLine: string, accent: LuxuryAccent = 'blue'): void {
  const total = pdf.getNumberOfPages();
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const rgb = accentRgb(accent);
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...rgb);
    pdf.setLineWidth(0.35);
    pdf.line(LUX.M, h - 13, w - LUX.M, h - 13);
    pdf.setFontSize(7.5);
    pdf.setTextColor(...LUX.MUTED);
    pdf.setFont('helvetica', 'normal');
    const line = footerLine.includes('{n}') ? footerLine.replace('{n}', `${i} / ${total}`) : `${footerLine} · ${i} / ${total}`;
    pdf.text(line, w / 2, h - 7, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
  }
}

/** Pied de page archive : mention Sentinel, date, SHA-256 du payload figé, ligne de périmètre + pagination. */
export function luxuryStampSentinelFooters(
  pdf: jsPDF,
  opts: {
    scopeLineWithPage: string;
    generatedAt: Date;
    integritySha256Hex: string;
    accent?: LuxuryAccent;
  }
): void {
  const total = pdf.getNumberOfPages();
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const rgb = accentRgb(opts.accent ?? 'blue');
  const dateFr = opts.generatedAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...rgb);
    pdf.setLineWidth(0.35);
    pdf.line(LUX.M, h - 20, w - LUX.M, h - 20);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...LUX.MUTED);
    const line1 = `Document généré numériquement par l'automate Sentinel REPUTEXA le ${dateFr}`;
    pdf.text(line1, w / 2, h - 15.2, { align: 'center' });

    pdf.setFontSize(6.2);
    const line2 = `Empreinte d'intégrité (SHA-256) : ${opts.integritySha256Hex}`;
    pdf.text(line2, w / 2, h - 10.5, { align: 'center' });

    pdf.setFontSize(7.5);
    const scope = opts.scopeLineWithPage.includes('{n}')
      ? opts.scopeLineWithPage.replace('{n}', `${i} / ${total}`)
      : `${opts.scopeLineWithPage} · ${i} / ${total}`;
    pdf.text(scope, w / 2, h - 5.6, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
  }
}

/** Bandeau de section (fond slate clair + titre). */
export function luxurySectionBand(pdf: jsPDF, title: string, y: number): number {
  const w = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(LUX.M, y - 5, w - 2 * LUX.M, 10, 1.3, 1.3, 'F');
  pdf.setDrawColor(...LUX.BORDER);
  pdf.setLineWidth(0.15);
  pdf.roundedRect(LUX.M, y - 5, w - 2 * LUX.M, 10, 1.3, 1.3, 'S');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(...LUX.SLATE900);
  pdf.text(title, LUX.M + 3, y + 2.2);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  return y + 14;
}

/** Assure la place verticale ; nouvelle page si besoin. */
export function luxuryEnsureY(pdf: jsPDF, y: number, neededMm: number): number {
  if (y + neededMm > LUX.PAGE_BOTTOM) {
    pdf.addPage();
    return LUX.PAGE_TOP;
  }
  return y;
}

/** Couverture premium (bandeau navy + filet accent). */
export function luxuryDrawCover(
  pdf: jsPDF,
  opts: {
    kicker: string;
    title: string;
    subtitle: string;
    metaLines: string[];
    bodyBlurb: string;
    accent?: LuxuryAccent;
  }
): void {
  const w = pdf.internal.pageSize.getWidth();
  const accent = opts.accent ?? 'blue';
  pdf.setFillColor(...LUX.NAVY);
  pdf.rect(0, 0, w, 78, 'F');
  pdf.setDrawColor(...accentRgb(accent));
  pdf.setLineWidth(0.65);
  pdf.line(LUX.M, 72, w - LUX.M, 72);

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(opts.kicker.toUpperCase(), LUX.M, 19);
  pdf.setFontSize(24);
  pdf.text(opts.title, LUX.M, 37);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(203, 213, 225);
  pdf.text(opts.subtitle, LUX.M, 48);
  let my = 58;
  pdf.setFontSize(9);
  for (const line of opts.metaLines) {
    pdf.text(line, LUX.M, my);
    my += 4.5;
  }

  pdf.setTextColor(51, 65, 85);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  const blurb = pdf.splitTextToSize(opts.bodyBlurb, LUX.TEXT_MAX);
  let y = 90;
  for (const line of blurb) {
    pdf.text(line, LUX.M, y);
    y += LUX.LINE_STD;
  }
}

/**
 * Un traitement Art.30 : nouvelle page dédiée, bandeau titre, tableau Champ | Valeur.
 */
export function luxuryDrawRegistreTreatment(
  pdf: jsPDF,
  section: RegistreTreatmentSection,
  treatmentIndex: number
): void {
  pdf.addPage();
  let y: number = LUX.PAGE_TOP;
  const w = pdf.internal.pageSize.getWidth();
  const innerW = w - 2 * LUX.M;

  pdf.setFillColor(...LUX.HEADER_BG);
  pdf.roundedRect(LUX.M, y, innerW, 12, 1.5, 1.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  const titleLine =
    section.title.length > 95
      ? `${section.title.slice(0, 92)}…`
      : section.title;
  pdf.text(`Traitement ${treatmentIndex} — ${titleLine}`, LUX.M + 3, y + 8);
  pdf.setTextColor(0, 0, 0);
  y += 18;

  const labelW = 54;
  const gap = 3;
  const valueW = innerW - labelW - gap;
  const xLabel = LUX.M + 2;
  const xValue = LUX.M + labelW + gap + 2;

  pdf.setFillColor(226, 232, 240);
  pdf.rect(LUX.M, y, innerW, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);
  pdf.text('Champ', xLabel, y + 5);
  pdf.text('Valeur', xValue, y + 5);
  pdf.setDrawColor(...LUX.BORDER);
  pdf.setLineWidth(0.2);
  pdf.line(LUX.M, y + 7, LUX.M + innerW, y + 7);
  y += 10;
  pdf.setFont('helvetica', 'normal');

  section.rows.forEach((row, i) => {
    const alt = i % 2 === 0 ? LUX.ROW_A : LUX.ROW_B;
    const labParts = pdf.splitTextToSize(row.label, labelW - 4);
    const valParts = pdf.splitTextToSize(row.value, valueW - 4);
    const lines = Math.max(labParts.length, valParts.length);
    const rowH = Math.max(lines * LUX.LINE_TIGHT + 4, 8);

    y = luxuryEnsureY(pdf, y, rowH + 6);
    pdf.setFillColor(...alt);
    pdf.rect(LUX.M, y - 1, innerW, rowH, 'F');
    pdf.setDrawColor(...LUX.BORDER);
    pdf.rect(LUX.M, y - 1, innerW, rowH, 'S');
    pdf.line(LUX.M + labelW + gap / 2, y - 1, LUX.M + labelW + gap / 2, y - 1 + rowH);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    let ly = y + 3.5;
    for (const ln of labParts) {
      pdf.text(ln, xLabel, ly);
      ly += LUX.LINE_TIGHT;
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(30, 41, 59);
    ly = y + 3.5;
    for (const ln of valParts) {
      pdf.text(ln, xValue, ly);
      ly += LUX.LINE_TIGHT;
    }

    y += rowH + 0.5;
  });
}

/** Bloc “code” pour CSV / Markdown (fond discret + bordure), pagination automatique. */
export function luxuryDrawMonospaceBlock(pdf: jsPDF, startY: number, text: string, maxCharsTruncate?: number): number {
  let body = text;
  if (maxCharsTruncate && body.length > maxCharsTruncate) {
    body = `${body.slice(0, maxCharsTruncate)}\n\n[… contenu tronque]`;
  }
  let y = startY;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(51, 65, 85);
  const lines = pdf.splitTextToSize(body, LUX.TEXT_MAX - 6);
  const w = pdf.internal.pageSize.getWidth();
  const pad = 5;
  const maxY = LUX.PAGE_BOTTOM - 10;
  let i = 0;
  while (i < lines.length) {
    y = luxuryEnsureY(pdf, y, 24);
    const chunk: string[] = [];
    let ty = y + pad;
    while (i < lines.length && ty + LUX.LINE_TIGHT <= maxY) {
      chunk.push(lines[i]);
      ty += LUX.LINE_TIGHT;
      i++;
    }
    const blockH = chunk.length * LUX.LINE_TIGHT + pad * 2;
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(...LUX.BORDER);
    pdf.roundedRect(LUX.M, y, w - 2 * LUX.M, blockH, 1.2, 1.2, 'FD');
    ty = y + pad;
    for (const ln of chunk) {
      pdf.text(ln, LUX.M + 3, ty);
      ty += LUX.LINE_TIGHT;
    }
    y += blockH + 4;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  return y;
}

/** Ligne de journal avec fond carte légère. */
export function luxuryDrawLogCard(pdf: jsPDF, lines: string[], startY: number): number {
  let y = startY;
  const w = pdf.internal.pageSize.getWidth();
  const innerW = w - 2 * LUX.M;
  const combined = lines.join('\n');
  const parts = pdf.splitTextToSize(combined, innerW - 8);
  const h = parts.length * LUX.LINE_TIGHT + 7;
  y = luxuryEnsureY(pdf, y, h + 2);
  pdf.setFillColor(249, 250, 251);
  pdf.setDrawColor(...LUX.BORDER);
  pdf.roundedRect(LUX.M, y, innerW, h, 1, 1, 'FD');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  let ty = y + 5;
  for (const ln of parts) {
    pdf.text(ln, LUX.M + 4, ty);
    ty += LUX.LINE_TIGHT;
  }
  pdf.setTextColor(0, 0, 0);
  return y + h + 3;
}
