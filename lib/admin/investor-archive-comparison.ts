/**
 * Comparatif des exports PDF data-room (synthèses JSON stockées à l’archivage).
 */

export type ParsedArchiveSummary = {
  generatedAt: string | null;
  totalCashEur: number | null;
  mrrEur: number | null;
  arrImpliedEur: number | null;
  activeSubscriptions: number | null;
  burnMonthEur: number | null;
  openaiEurMonth: number | null;
  resendEurMonth: number | null;
  contributionMarginPct: number | null;
  variableCostRatioPct: number | null;
  contributionAfterVariableEur: number | null;
  avgMrrPerSubEur: number | null;
  unmatchedStripeSubs: number | null;
  nonAdminProfilesLoaded: number | null;
  openaiError: string | null;
  paidRevenueMonths: number | null;
};

export type ArchiveTimelineRow = {
  archiveId: string;
  exportedAt: string;
  fileName: string;
  summary: ParsedArchiveSummary;
  deltaMrrEur: number | null;
  deltaMrrPct: number | null;
  deltaCashEur: number | null;
  deltaCashPct: number | null;
  deltaAbos: number | null;
  deltaMarginPts: number | null;
  deltaBurnEur: number | null;
};

/** Données pour libellés i18n (plus de chaînes utilisateur en dur côté lib). */
export type InsightBullet =
  | { type: 'watch_single_export' }
  | { type: 'watch_empty_series' }
  | { type: 'mrr_up'; prev: number; next: number; deltaPct: number | null; deltaEur: number }
  | { type: 'mrr_down'; absDeltaEur: number; deltaPct: number | null }
  | { type: 'cash_up'; delta: number }
  | { type: 'cash_down'; delta: number }
  | { type: 'subs_up'; delta: number }
  | { type: 'subs_down'; delta: number }
  | { type: 'margin_up'; deltaPts: number }
  | { type: 'margin_down'; deltaPts: number }
  | { type: 'burn_up'; delta: number }
  | { type: 'burn_down'; absDelta: number }
  | { type: 'openai_error'; error: string }
  | { type: 'unmatched'; count: number };

export type ArchiveSpanMeta = {
  exportCount: number;
  days: number;
};

export type ArchiveComparisonInsights = {
  bulletsPositive: InsightBullet[];
  bulletsNegative: InsightBullet[];
  bulletsWatch: InsightBullet[];
  exportCount: number;
  /** Présent seulement si au moins 2 exports (série comparable). */
  spanMeta: ArchiveSpanMeta | null;
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return String(v);
}

export function parseArchiveSummary(raw: unknown): ParsedArchiveSummary {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    generatedAt: str(o.generatedAt),
    totalCashEur: num(o.totalCashEur),
    mrrEur: num(o.mrrEur),
    arrImpliedEur: num(o.arrImpliedEur),
    activeSubscriptions: num(o.activeSubscriptions),
    burnMonthEur: num(o.burnMonthEur),
    openaiEurMonth: num(o.openaiEurMonth),
    resendEurMonth: num(o.resendEurMonth),
    contributionMarginPct: num(o.contributionMarginPct),
    variableCostRatioPct: num(o.variableCostRatioPct),
    contributionAfterVariableEur: num(o.contributionAfterVariableEur),
    avgMrrPerSubEur: num(o.avgMrrPerSubEur),
    unmatchedStripeSubs: num(o.unmatchedStripeSubs),
    nonAdminProfilesLoaded: num(o.nonAdminProfilesLoaded),
    openaiError: str(o.openaiError),
    paidRevenueMonths: num(o.paidRevenueMonths),
  };
}

function pctDelta(prev: number, cur: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function buildArchiveTimeline(
  archives: Array<{ id: string; created_at: string; file_name: string; summary: unknown | null }>
): ArchiveTimelineRow[] {
  const chron = [...archives].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const rows: ArchiveTimelineRow[] = [];
  let prev: ParsedArchiveSummary | null = null;

  for (const a of chron) {
    const summary = parseArchiveSummary(a.summary);
    let deltaMrrEur: number | null = null;
    let deltaMrrPct: number | null = null;
    let deltaCashEur: number | null = null;
    let deltaCashPct: number | null = null;
    let deltaAbos: number | null = null;
    let deltaMarginPts: number | null = null;
    let deltaBurnEur: number | null = null;

    if (prev) {
      if (summary.mrrEur != null && prev.mrrEur != null) {
        deltaMrrEur = summary.mrrEur - prev.mrrEur;
        deltaMrrPct = pctDelta(prev.mrrEur, summary.mrrEur);
      }
      if (summary.totalCashEur != null && prev.totalCashEur != null) {
        deltaCashEur = summary.totalCashEur - prev.totalCashEur;
        deltaCashPct = pctDelta(prev.totalCashEur, summary.totalCashEur);
      }
      if (summary.activeSubscriptions != null && prev.activeSubscriptions != null) {
        deltaAbos = summary.activeSubscriptions - prev.activeSubscriptions;
      }
      if (summary.contributionMarginPct != null && prev.contributionMarginPct != null) {
        deltaMarginPts = summary.contributionMarginPct - prev.contributionMarginPct;
      }
      if (summary.burnMonthEur != null && prev.burnMonthEur != null) {
        deltaBurnEur = summary.burnMonthEur - prev.burnMonthEur;
      }
    }

    rows.push({
      archiveId: a.id,
      exportedAt: a.created_at,
      fileName: a.file_name,
      summary,
      deltaMrrEur,
      deltaMrrPct,
      deltaCashEur,
      deltaCashPct,
      deltaAbos,
      deltaMarginPts,
      deltaBurnEur,
    });
    prev = summary;
  }

  return rows;
}

export function buildArchiveInsights(timeline: ArchiveTimelineRow[]): ArchiveComparisonInsights {
  const bulletsPositive: InsightBullet[] = [];
  const bulletsNegative: InsightBullet[] = [];
  const bulletsWatch: InsightBullet[] = [];

  if (timeline.length < 2) {
    return {
      bulletsPositive,
      bulletsNegative,
      bulletsWatch:
        timeline.length === 0
          ? [{ type: 'watch_empty_series' }]
          : [{ type: 'watch_single_export' }],
      exportCount: timeline.length,
      spanMeta: null,
    };
  }

  const first = timeline[0]!;
  const last = timeline[timeline.length - 1]!;
  const a0 = first.summary;
  const a1 = last.summary;

  if (a0.mrrEur != null && a1.mrrEur != null) {
    const d = a1.mrrEur - a0.mrrEur;
    const p = pctDelta(a0.mrrEur, a1.mrrEur);
    if (d > 0.005 && (p == null || p > 0)) {
      bulletsPositive.push({
        type: 'mrr_up',
        prev: a0.mrrEur,
        next: a1.mrrEur,
        deltaPct: p,
        deltaEur: d,
      });
    } else if (d < -0.005) {
      bulletsNegative.push({
        type: 'mrr_down',
        absDeltaEur: Math.abs(d),
        deltaPct: p,
      });
    }
  }

  if (a0.totalCashEur != null && a1.totalCashEur != null) {
    const d = a1.totalCashEur - a0.totalCashEur;
    if (d > 0.02) {
      bulletsPositive.push({ type: 'cash_up', delta: d });
    } else if (d < -0.02) {
      bulletsNegative.push({ type: 'cash_down', delta: d });
    }
  }

  if (a0.activeSubscriptions != null && a1.activeSubscriptions != null) {
    const d = a1.activeSubscriptions - a0.activeSubscriptions;
    if (d > 0) {
      bulletsPositive.push({ type: 'subs_up', delta: d });
    } else if (d < 0) {
      bulletsNegative.push({ type: 'subs_down', delta: d });
    }
  }

  if (a0.contributionMarginPct != null && a1.contributionMarginPct != null) {
    const d = a1.contributionMarginPct - a0.contributionMarginPct;
    if (d > 0.3) {
      bulletsPositive.push({ type: 'margin_up', deltaPts: d });
    } else if (d < -0.3) {
      bulletsNegative.push({ type: 'margin_down', deltaPts: d });
    }
  }

  if (a0.burnMonthEur != null && a1.burnMonthEur != null) {
    const d = a1.burnMonthEur - a0.burnMonthEur;
    if (d > 0.02) {
      bulletsWatch.push({ type: 'burn_up', delta: d });
    } else if (d < -0.02) {
      bulletsPositive.push({ type: 'burn_down', absDelta: Math.abs(d) });
    }
  }

  if (a1.openaiError) {
    bulletsWatch.push({ type: 'openai_error', error: a1.openaiError });
  }

  if (a1.unmatchedStripeSubs != null && a1.unmatchedStripeSubs > 0) {
    bulletsWatch.push({ type: 'unmatched', count: a1.unmatchedStripeSubs });
  }

  const t0 = new Date(first.exportedAt).getTime();
  const t1 = new Date(last.exportedAt).getTime();
  const days = Math.max(1, Math.round((t1 - t0) / 86400000));

  return {
    bulletsPositive,
    bulletsNegative,
    bulletsWatch,
    exportCount: timeline.length,
    spanMeta: { exportCount: timeline.length, days },
  };
}
