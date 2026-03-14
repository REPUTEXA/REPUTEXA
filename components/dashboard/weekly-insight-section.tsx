'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TrendingUp, AlertTriangle, Lightbulb, ChevronDown, ChevronRight } from 'lucide-react';
import type { PlanSlug } from '@/lib/feature-gate';
import { hasFeature, FEATURES } from '@/lib/feature-gate';
import { useActiveLocationOptional } from '@/lib/active-location-context';

type WeeklyReport = {
  id: string;
  week_start: string;
  establishment_name: string;
  avg_rating: number;
  total_reviews: number;
  top_section: string | null;
  watch_section: string | null;
  advice_section: string | null;
  full_report_json: { fullReport?: string; weekLabel?: string } | null;
  trend_severity: number | null;
  created_at: string;
};

type Props = { planSlug: PlanSlug };

function formatWeekLabel(weekStart: string): string {
  if (!weekStart) return '';
  const d = new Date(weekStart + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function WeeklyInsightSection({ planSlug }: Props) {
  const searchParams = useSearchParams();
  const activeLocation = useActiveLocationOptional();
  const activeLocationId = activeLocation?.activeLocationId ?? 'profile';
  const openTab = searchParams?.get('tab') === 'weekly';
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(5);

  const canAccess = hasFeature(planSlug, FEATURES.REPORTING_WHATSAPP_RECAP);

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    const url = activeLocationId ? `/api/weekly-insight?establishmentId=${encodeURIComponent(activeLocationId)}` : '/api/weekly-insight';
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const list = data.reports ?? [];
        setReports(list);
        if (openTab && list.length > 0) {
          setExpandedId(list[0]?.id ?? null);
        }
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [canAccess, activeLocationId]);

  if (!canAccess) return null;

  const cardClass =
    'rounded-2xl border border-white/20 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_0_24px_-8px_rgba(59,130,246,0.12)] dark:shadow-[0_0_24px_-8px_rgba(0,0,0,0.3)]';

  return (
    <section id="weekly" className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <span>📊</span>
          Historique des Analyses Hebdomadaires
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Rapports générés par l&apos;IA et envoyés sur WhatsApp
        </p>
      </div>

      {loading ? (
        <div className={`${cardClass} p-8 text-center text-slate-500 dark:text-slate-400`}>
          Chargement...
        </div>
      ) : reports.length === 0 ? (
        <div className={`${cardClass} p-8 text-center`}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Aucune archive disponible pour le moment.
          </p>
        </div>
      ) : (
        <>
          <div className={`${cardClass} overflow-hidden divide-y divide-slate-200 dark:divide-slate-800`}>
          {reports.slice(0, displayCount).map((insight) => {
            const isExpanded = expandedId === insight.id;
            const weekLabel = formatWeekLabel(insight.week_start);

            return (
              <div key={insight.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    Analyse Stratégique — Semaine du {weekLabel}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {insight.avg_rating?.toFixed(1)}/5 · {insight.total_reviews} avis
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 space-y-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-4">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {insight.avg_rating?.toFixed(1)}/5 · {insight.total_reviews} avis
                      </p>
                    </div>

                    {insight.trend_severity != null && insight.trend_severity > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Indice de vigilance</p>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              (insight.trend_severity ?? 0) >= 70
                                ? 'bg-red-500'
                                : (insight.trend_severity ?? 0) >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, insight.trend_severity ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {insight.full_report_json?.fullReport && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-4">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Analyse stratégique détaillée</p>
                        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {insight.full_report_json.fullReport}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Le Top</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {insight.top_section || '—'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">À surveiller</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {insight.watch_section || 'Rien de critique.'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Conseil IA</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {insight.advice_section || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
          {reports.length > displayCount && (
            <button
              type="button"
              onClick={() => setDisplayCount((c) => c + 5)}
              className="mt-4 w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              Voir plus
            </button>
          )}
        </>
      )}
    </section>
  );
}
