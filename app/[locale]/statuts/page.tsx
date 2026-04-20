'use client';

import { useLocale, useTranslations } from 'next-intl';
import { PublicPageShell } from '@/components/public-page-shell';
import { CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, Activity } from 'lucide-react';
import {
  getStatutsPublicContent,
  STATUTS_HEATMAP_INCIDENT_DAYS,
  statutsHeatmapCellTitle,
  type ServiceStatus,
} from '@/lib/i18n/pages/statuts-public-content';

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-amber-500/20 text-amber-400',
  major: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

const STATUTS_LASTCHECK_DATETIME_OPTIONS: Pick<
  Intl.DateTimeFormatOptions,
  'day' | 'month' | 'year' | 'hour' | 'minute'
> = {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export default function StatutsPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const tSentinel = useTranslations('StatutsPage.sentinel');
  const now = new Date();
  const c = getStatutsPublicContent(locale);
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
  const allOperational = c.services.every((s) => s.status === 'operational');
  const sentinelEyebrow = tSentinel('eyebrow');
  const sentinelTitle = tSentinel('title');
  const sentinelBody = tSentinel('body');

  const statusUi: Record<
    ServiceStatus,
    { icon: typeof CheckCircle; color: string; dot: string }
  > = {
    operational: { icon: CheckCircle, color: 'text-emerald-400', dot: 'bg-emerald-500' },
    degraded: { icon: AlertTriangle, color: 'text-amber-400', dot: 'bg-amber-500' },
    outage: { icon: XCircle, color: 'text-red-400', dot: 'bg-red-500' },
  };

  return (
    <PublicPageShell title={t('statuts.title')} subtitle={t('statuts.subtitle')}>
      {/* Global status banner */}
      <div
        className={`mb-10 rounded-2xl border p-5 flex items-center gap-4 ${
          allOperational
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-amber-500/30 bg-amber-500/5'
        }`}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
          <Activity className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <p className="font-display font-bold text-white">
              {allOperational ? c.bannerAllOk : c.bannerDegraded}
            </p>
          </div>
          <p className="text-xs text-gray-500 ml-5.5">
            {c.lastCheckPrefix}{' '}
            {now.toLocaleString(dateLocale, STATUTS_LASTCHECK_DATETIME_OPTIONS)}
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {c.refresh}
        </button>
      </div>

      <section
        className="mb-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
        aria-labelledby="statuts-sentinel-heading"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-400/90 mb-2">
          {sentinelEyebrow}
        </p>
        <h2 id="statuts-sentinel-heading" className="font-display text-base sm:text-lg font-bold text-white mb-3">
          {sentinelTitle}
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">{sentinelBody}</p>
      </section>

      {/* 90-day metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {c.metrics.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="font-display text-xl font-bold text-white mb-0.5">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xs text-gray-600 mt-0.5">{c.metricsPeriod}</p>
          </div>
        ))}
      </div>

      {/* Services list */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-bold text-white mb-4">{c.sectionComponents}</h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {c.services.map(({ id, name, description, status, uptime }, i) => {
            const ui = statusUi[status];
            const StatusIcon = ui.icon;
            const statusLabel = c.statusLabels[status];
            return (
              <div
                key={id}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors ${i < c.services.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm">{name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-500 hidden sm:block">{uptime}</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ui.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Uptime bars (visual) */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-bold text-white mb-4">{c.sectionUptime}</h2>
        <div className="space-y-3">
          {c.services.slice(0, 6).map(({ id, name, uptime }) => (
            <div key={id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400">{name}</span>
                <span className="text-xs font-medium text-emerald-400">{uptime}</span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 90 }).map((_, day) => {
                  const incidentDay = STATUTS_HEATMAP_INCIDENT_DAYS[id];
                  const hasIncident = incidentDay !== undefined && day === incidentDay;
                  return (
                    <div
                      key={day}
                      className={`flex-1 h-6 rounded-[2px] ${hasIncident ? 'bg-amber-500/60' : 'bg-emerald-500/40'}`}
                      title={statutsHeatmapCellTitle(locale, day, hasIncident)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/40" /> {c.legendOperational}
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/60 ml-2" /> {c.legendMinor}
        </p>
      </section>

      {/* Past incidents */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-bold text-white mb-4">{c.sectionIncidents}</h2>
        {c.incidents.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{c.emptyIncidents}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {c.incidents.map(({ date, title, severity, duration, resolution }) => (
              <div key={`${date}-${title}`} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-semibold text-white text-sm">{title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[severity]}`}>
                        {c.severityMinor}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{date}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {c.durationPrefix} {duration}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 ml-7">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-400 leading-relaxed">{resolution}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PublicPageShell>
  );
}
