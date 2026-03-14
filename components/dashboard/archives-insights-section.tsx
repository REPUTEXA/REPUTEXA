'use client';

import { useEffect, useState } from 'react';
import { FileText, ArrowRight, Download } from 'lucide-react';
import type { PlanSlug } from '@/lib/feature-gate';
import type { SummaryStats } from '@/lib/monthly-reports/types';

type Report = {
  id: string;
  month: number;
  year: number;
  report_type: string;
  pdf_url: string | null;
  summary_stats: SummaryStats | null;
  created_at: string;
};

type ArchivesInsightsSectionProps = {
  planSlug: PlanSlug;
  locale: string;
};

const cardClass =
  'rounded-2xl border border-white/20 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_0_24px_-8px_rgba(59,130,246,0.12)] dark:shadow-[0_0_24px_-8px_rgba(0,0,0,0.3)]';

export function ArchivesInsightsSection({ planSlug, locale }: ArchivesInsightsSectionProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const isVision = planSlug === 'vision';

  useEffect(() => {
    let cancelled = false;
    async function fetchReports() {
      try {
        const res = await fetch('/api/monthly-reports/list');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data.reports)) return;
        setReports(data.reports);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchReports();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded" />
      </section>
    );
  }

  const sortedReports = [...reports].sort((a, b) => {
    const da = new Date(a.year, a.month - 1, 1).getTime();
    const db = new Date(b.year, b.month - 1, 1).getTime();
    return db - da;
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <span>📁</span>
          Centre de Téléchargement PDF
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Rapports mensuels envoyés par email
        </p>
      </div>

      {isVision && (
        <div className={`${cardClass} px-4 py-3 flex items-center justify-between gap-4`}>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Passez à <strong>Pulse</strong> pour débloquer les rapports PDF mensuels.
          </p>
          <a
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline"
          >
            <ArrowRight className="w-4 h-4" />
            Voir les offres
          </a>
        </div>
      )}

      <div className={`${cardClass} overflow-hidden`}>
        {reports.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aucune archive disponible pour le moment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/80">
                  <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Nom du document
                  </th>
                  <th className="text-right px-5 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.map((r) => {
                  const dateLabel = new Date(r.year, r.month - 1, 1).toLocaleDateString(
                    locale === 'fr' ? 'fr-FR' : 'en-US',
                    { day: 'numeric', month: 'long', year: 'numeric' }
                  );
                  const docName = `Rapport REPUTEXA - ${new Date(r.year, r.month - 1, 1).toLocaleDateString(
                    locale === 'fr' ? 'fr-FR' : 'en-US',
                    { month: 'long', year: 'numeric' }
                  )}.pdf`;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {dateLabel}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[220px] sm:max-w-none">
                            {docName}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.pdf_url ? (
                          <a
                            href={r.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Télécharger
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">En cours</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
