'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions, NumberFormatOptions } from 'use-intl';
import { Link } from '@/i18n/navigation';
import { Globe2, Radio, ShieldAlert, Building2, Scale, Send, Languages } from 'lucide-react';
import { GrowthEquirectMap, type GrowthMapMarker } from '@/components/admin/growth-equirect-map';
import { useGrowthCountryLabel } from '@/lib/admin/use-growth-country-label';

const FEED_ROW_DATETIME: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'medium',
};

const PERCENT_ESTIMATE: NumberFormatOptions = {
  style: 'percent',
  maximumFractionDigits: 0,
};

/** Provider values (API) — labels via messages. */
const OUTREACH_PROVIDER_ROWS = [
  { value: 'instantly', labelKey: 'providerInstantly' as const },
  { value: 'smartlead', labelKey: 'providerSmartlead' as const },
] as const;

const MAP_LEGEND_PHASES = [
  'scanned',
  'outreach_recent',
  'no_response',
  'engaged',
  'opted_out',
  'customer',
  'trial',
  'lost',
] as const;

const LEGEND_PHASE_TO_MSG_KEY: Record<(typeof MAP_LEGEND_PHASES)[number], string> = {
  scanned: 'legend_scanned',
  outreach_recent: 'legend_outreach_recent',
  no_response: 'legend_no_response',
  engaged: 'legend_engaged',
  opted_out: 'legend_opted_out',
  customer: 'legend_customer',
  trial: 'legend_trial',
  lost: 'legend_lost',
};

type CountryRow = {
  countryCode: string;
  outreachEnabled: boolean;
  dailyOutreachCap: number;
  localeDefault: string;
  publicSiteLocaleEnabled: boolean;
  outreachProvider: string | null;
  instantlyCampaignId: string | null;
  smartleadCampaignId: string | null;
  notes: string | null;
  updatedAt: string;
};

type SiteLocaleRow = {
  code: string;
  labelFr: string;
  alwaysPublic: boolean;
  gateCountryCode: string | null;
  publicSiteOpen: boolean;
};

type WarRoomPayload = {
  luxuryPartnerBrands?: string[];
  countries: CountryRow[];
  prospectStatusCounts: Record<string, number>;
  domainStatusCounts: Record<string, number>;
  touches24h: number;
  markers: GrowthMapMarker[];
  feed: { id: string; at: string; channel: string; subjectOrRef: string | null; prospectName: string | null }[];
  webhookOutreachUrl?: string;
  siteLocales?: SiteLocaleRow[];
};

type CountryDetail = {
  country: CountryRow;
  domains: { id: string; hostname: string; countryCode: string | null; status: string; notes: string | null }[];
  stats: {
    prospectsTotal: number;
    prospectsWithEmail: number;
    byStatus: Record<string, number>;
    contactedWithOutreach: number;
    opened: number;
    clicked: number;
    openRate: number | null;
    clickRate: number | null;
  };
};

export function GrowthWarRoomClient() {
  const t = useTranslations('Dashboard.adminGrowthWarRoom');
  const countryLabel = useGrowthCountryLabel();
  const [data, setData] = useState<WarRoomPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [tab, setTab] = useState<'world' | string>('world');
  const [detail, setDetail] = useState<CountryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState<Partial<CountryRow> | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/growth-war-room', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errLoad'));
      setData(j as WarRoomPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (code: string) => {
    setDetailLoading(true);
    setSyncMsg(null);
    try {
      const r = await fetch(`/api/admin/growth-country-detail?code=${encodeURIComponent(code)}`, {
        cache: 'no-store',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errDetail'));
      setDetail(j as CountryDetail);
      setForm({ ...(j as CountryDetail).country });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errGeneric'));
      setDetail(null);
      setForm(null);
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab !== 'world') void loadDetail(tab);
  }, [tab, loadDetail]);

  const toggleCountry = async (countryCode: string, outreachEnabled: boolean) => {
    setBusyCode(countryCode);
    try {
      const r = await fetch('/api/admin/growth-country-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode, outreachEnabled }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errUpdate'));
      setData((prev) =>
        prev
          ? {
              ...prev,
              countries: prev.countries.map((c) =>
                c.countryCode === countryCode ? { ...c, ...j.country } : c
              ),
            }
          : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusyCode(null);
    }
  };

  const saveCountryForm = async () => {
    if (!form || tab === 'world') return;
    setBusyCode(tab);
    try {
      const r = await fetch('/api/admin/growth-country-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode: tab,
          publicSiteLocaleEnabled: form.publicSiteLocaleEnabled,
          outreachEnabled: form.outreachEnabled,
          dailyOutreachCap: form.dailyOutreachCap,
          outreachProvider: form.outreachProvider || null,
          instantlyCampaignId: form.instantlyCampaignId || null,
          smartleadCampaignId: form.smartleadCampaignId || null,
          notes: form.notes,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errSave'));
      setData((prev) =>
        prev
          ? {
              ...prev,
              countries: prev.countries.map((c) =>
                c.countryCode === tab ? { ...c, ...j.country } : c
              ),
            }
          : prev
      );
      setForm((f) => (f ? { ...f, ...j.country } : f));
      await loadDetail(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusyCode(null);
    }
  };

  const addDomain = async () => {
    if (!newDomain.trim() || tab === 'world') return;
    setBusyCode(tab);
    try {
      const r = await fetch('/api/admin/outreach-domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: tab, hostname: newDomain.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errAdd'));
      setNewDomain('');
      await loadDetail(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusyCode(null);
    }
  };

  const syncInstantly = async () => {
    if (tab === 'world') return;
    setBusyCode(tab);
    setSyncMsg(null);
    try {
      const r = await fetch('/api/admin/outreach-sync-instantly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: tab, limit: 100 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errSync'));
      setSyncMsg(
        t('syncInstantlyDetail', {
          pushed: j.pushed ?? 0,
          requested: j.requested ?? 0,
          status: String(j.instantlyStatus ?? ''),
        }),
      );
      await load();
      await loadDetail(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusyCode(null);
    }
  };

  const tRich = t.rich;

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-16 text-center text-sm text-zinc-500">
        {t('loadingPost')}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-950/30 px-6 py-8 text-sm text-red-200">
        {error}
        <p className="mt-2 text-xs text-red-300/80">
          {tRich('loadErrorPrismaRich', {
            mono: (chunks) => <code className="text-red-200">{chunks}</code>,
          })}
        </p>
        <p className="mt-1 text-xs text-red-300/80">{t('migrationsHint')}</p>
      </div>
    );
  }

  if (!data) return null;

  const totalProspects = Object.values(data.prospectStatusCounts).reduce((a, b) => a + b, 0);
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const webhookFull = data.webhookOutreachUrl ? `${origin}${data.webhookOutreachUrl}` : '';

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-2 text-xs text-amber-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => setTab('world')}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            tab === 'world'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t('tabWorld')}
        </button>
        {data.countries.map((c) => (
          <button
            key={c.countryCode}
            type="button"
            title={t('titleIsoCode', { code: c.countryCode })}
            onClick={() => setTab(c.countryCode)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            tab === c.countryCode
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
          }`}
          >
            {countryLabel(c.countryCode)}
            {c.outreachEnabled ? (
              <span className="ml-1 text-[10px] opacity-80">{t('outreachDot')}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'world' ? (
        <WorldView
          data={data}
          totalProspects={totalProspects}
          webhookFull={webhookFull}
          busyCode={busyCode}
          toggleCountry={toggleCountry}
          onReload={load}
        />
      ) : (
        <CountryView
          code={tab}
          countryLabel={countryLabel(tab)}
          detailLoading={detailLoading}
          detail={detail}
          form={form}
          setForm={setForm}
          newDomain={newDomain}
          setNewDomain={setNewDomain}
          busyCode={busyCode}
          saveCountryForm={saveCountryForm}
          addDomain={addDomain}
          syncInstantly={syncInstantly}
          syncMsg={syncMsg}
          webhookFull={webhookFull}
          luxuryPartnerBrands={data.luxuryPartnerBrands ?? []}
        />
      )}
    </div>
  );
}

function WorldView({
  data,
  totalProspects,
  webhookFull,
  busyCode,
  toggleCountry,
  onReload,
}: {
  data: WarRoomPayload;
  totalProspects: number;
  webhookFull: string;
  busyCode: string | null;
  toggleCountry: (code: string, v: boolean) => void;
  onReload: () => Promise<void>;
}) {
  const t = useTranslations('Dashboard.adminGrowthWarRoom');
  const tRich = t.rich;
  const format = useFormatter();
  const countryLabel = useGrowthCountryLabel();
  const [hiddenPhases, setHiddenPhases] = useState<Set<string>>(() => new Set());
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [syncAllMsg, setSyncAllMsg] = useState<string | null>(null);

  const visibleMarkers = useMemo(() => {
    if (hiddenPhases.size === 0) return data.markers;
    return data.markers.filter((m) => !hiddenPhases.has(m.phase));
  }, [data.markers, hiddenPhases]);

  const toggleMapPhase = (phase: string) => {
    setHiddenPhases((prev) => {
      const n = new Set(prev);
      if (n.has(phase)) n.delete(phase);
      else n.add(phase);
      return n;
    });
  };

  const syncAllActiveMarkets = async () => {
    setSyncAllBusy(true);
    setSyncAllMsg(null);
    try {
      const r = await fetch('/api/admin/outreach-sync-all-active', { method: 'POST' });
      const j = (await r.json()) as {
        ok?: boolean;
        ran?: boolean;
        results?: { countryCode: string; ok: boolean; pushed?: number; error?: string }[];
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? t('errSync'));
      const rows = j.results ?? [];
      const okN = rows.filter((x) => x.ok).length;
      const parts = rows.map((x) =>
        x.ok
          ? t('syncRowOk', {
              label: countryLabel(x.countryCode),
              pushed: x.pushed ?? 0,
            })
          : t('syncRowErr', {
              label: countryLabel(x.countryCode),
              error: x.error ?? t('syncCountryErr'),
            }),
      );
      setSyncAllMsg(t('syncAllSummary', { ok: okN, total: rows.length, details: parts.join(' · ') }));
      await onReload();
    } catch (e) {
      setSyncAllMsg(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setSyncAllBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <ShieldAlert className="h-5 w-5 shrink-0 text-indigo-300 mt-0.5" aria-hidden />
        <div className="text-xs leading-relaxed text-indigo-100/90">
          <p className="font-medium text-indigo-200">{t('clustersTitle')}</p>
          <p className="mt-1 text-indigo-100/75">
            {t('domainIntroP1')}
            <strong className="text-indigo-200">{t('domainIntroStrong')}</strong>
            {t('domainIntroP2')}
          </p>
        </div>
      </div>

      {webhookFull ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 font-mono text-[11px] text-zinc-400">
          <span className="text-zinc-500">{t('webhookPrefix')}</span>
          <span className="text-indigo-300">{t('webhookHeaderName')}</span>
          <span className="text-zinc-500">{t('webhookMiddle')}</span>
          <span className="break-all text-zinc-200">{webhookFull}</span>
        </div>
      ) : null}

      {data.siteLocales && data.siteLocales.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Languages className="h-4 w-4 text-indigo-400" aria-hidden />
            {t('siteLocalesTitle')}
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 text-xs leading-relaxed text-zinc-400">
            <p>
              {tRich('localesPara1Rich', {
                mono: (chunks) => <code className="text-zinc-300">{chunks}</code>,
                mono2: (chunks) => <code className="text-zinc-300">{chunks}</code>,
                mono3: (chunks) => <code className="text-zinc-300">{chunks}</code>,
                strong: (chunks) => <strong className="text-zinc-200">{chunks}</strong>,
                fr: (chunks) => <strong className="text-zinc-200">{chunks}</strong>,
              })}
            </p>
            {tRich('localesPara2Rich', {
              warn: (chunks) => <p className="mt-2 text-amber-200/80">{chunks}</p>,
              mono: (chunks) => <code className="text-amber-100/90">{chunks}</code>,
              mono2: (chunks) => <code className="text-amber-100/90">{chunks}</code>,
              mono3: (chunks) => <code className="text-amber-100/90">{chunks}</code>,
            })}
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-800/80">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('thLanguage')}</th>
                  <th className="px-4 py-3 font-medium">{t('thUrl')}</th>
                  <th className="px-4 py-3 font-medium">{t('thPublicSiteCol')}</th>
                  <th className="px-4 py-3 font-medium">{t('thCountrySwitch')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {data.siteLocales.map((row) => {
                  const siteOk = row.alwaysPublic || row.publicSiteOpen;
                  return (
                    <tr key={row.code} className="bg-zinc-950/40">
                      <td className="px-4 py-3 text-zinc-200">
                        <span className="font-medium">{row.labelFr}</span>
                        <span className="ml-2 font-mono text-[10px] text-zinc-600">{row.code}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">/{row.code}</td>
                      <td className="px-4 py-3">
                        {siteOk ? (
                          <span className="text-emerald-400">{t('siteAccessible')}</span>
                        ) : (
                          <span className="text-amber-400">{t('sitePublishHint')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {row.gateCountryCode ? (
                          <span>{t('marketGate', { code: row.gateCountryCode, locale: '{locale}' })}</span>
                        ) : (
                          <span className="text-zinc-600">{t('gateAlwaysOpen')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t('statsProspectsTotal')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{format.number(totalProspects)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t('statsTouches24h')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{format.number(data.touches24h)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t('statsDomainsTracked')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {format.number(Object.values(data.domainStatusCounts).reduce((a, b) => a + b, 0))}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Globe2 className="h-4 w-4 text-indigo-400" />
          {t('globalViewTitle')}
        </div>
        <div className="overflow-hidden rounded-2xl border border-zinc-800/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                <th className="px-4 py-3 font-medium">{t('thCountry')}</th>
                <th className="px-4 py-3 font-medium">{t('thLocale')}</th>
                <th className="px-4 py-3 font-medium">{t('thSitePublic', { locale: '{locale}' })}</th>
                <th className="px-4 py-3 font-medium">{t('thCap')}</th>
                <th className="px-4 py-3 font-medium">{t('thOutreach')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {data.countries.map((c) => (
                <tr key={c.countryCode} className="bg-zinc-950/40">
                  <td className="px-4 py-3 text-zinc-200">
                    <span className="font-medium">{countryLabel(c.countryCode)}</span>
                    <span className="ml-2 font-mono text-[10px] text-zinc-600" title={t('columnIsoTitle')}>
                      {c.countryCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{c.localeDefault}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {c.publicSiteLocaleEnabled ? (
                      <span className="text-emerald-400">{t('sitePublicOn')}</span>
                    ) : (
                      <span className="text-zinc-600">{t('sitePublicOff')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-400">{format.number(c.dailyOutreachCap)}</td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={c.outreachEnabled}
                        disabled={busyCode === c.countryCode}
                        onChange={(e) => void toggleCountry(c.countryCode, e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/40"
                      />
                      <span className="text-xs text-zinc-400">
                        {c.outreachEnabled ? t('outreachActive') : t('outreachOff')}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-300">{t('syncAllTitle')}</p>
          <button
            type="button"
            disabled={syncAllBusy}
            onClick={() => void syncAllActiveMarkets()}
            className="rounded-lg bg-emerald-800/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {syncAllBusy ? t('syncAllBusy') : t('syncAllCta')}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">
          {tRich('syncAllCronNoteRich', {
            mono: (chunks) => <code className="text-zinc-400">{chunks}</code>,
            mono2: (chunks) => <code className="text-zinc-400">{chunks}</code>,
            mono3: (chunks) => <code className="text-zinc-400">{chunks}</code>,
          })}
        </p>
        {syncAllMsg ? (
          <p className="text-xs text-zinc-400 whitespace-pre-wrap break-words">{syncAllMsg}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Radio className="h-4 w-4 text-indigo-400" />
            {t('mapAllCountriesTitle')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHiddenPhases(new Set())}
              className="rounded-full border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800"
            >
              {t('mapShowAll')}
            </button>
            <span className="text-[10px] text-zinc-600">{t('mapHideStatus')}</span>
            {MAP_LEGEND_PHASES.map((phase) => {
              const hidden = hiddenPhases.has(phase);
              return (
                <button
                  key={phase}
                  type="button"
                  onClick={() => toggleMapPhase(phase)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                    hidden
                      ? 'border-zinc-800 text-zinc-600 opacity-50 line-through'
                      : 'border-indigo-500/35 text-indigo-200/90 hover:bg-indigo-950/40'
                  }`}
                >
                  {t(LEGEND_PHASE_TO_MSG_KEY[phase] as 'legend_scanned')}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[11px] text-zinc-500">
          {t('mapPoints', {
            visible: format.number(visibleMarkers.length),
            total: format.number(data.markers.length),
          })}
        </p>
        <GrowthEquirectMap markers={visibleMarkers} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">{t('feedTitle')}</h3>
        <div className="max-h-64 overflow-y-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/50 font-mono text-[11px]">
          {data.feed.length === 0 ? (
            <p className="px-4 py-6 text-center text-zinc-600">{t('feedEmpty')}</p>
          ) : (
            <ul className="divide-y divide-zinc-800/50">
              {data.feed.map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-zinc-400">
                  <span className="text-zinc-600">
                    {format.dateTime(new Date(row.at), FEED_ROW_DATETIME)}
                  </span>
                  <span className="text-indigo-300">{row.channel}</span>
                  <span className="text-zinc-300">{row.prospectName ?? t('selectEmpty')}</span>
                  {row.subjectOrRef ? <span className="truncate text-zinc-500">{row.subjectOrRef}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function CountryView({
  code,
  countryLabel,
  detailLoading,
  detail,
  form,
  setForm,
  newDomain,
  setNewDomain,
  busyCode,
  saveCountryForm,
  addDomain,
  syncInstantly,
  syncMsg,
  webhookFull,
  luxuryPartnerBrands,
}: {
  code: string;
  countryLabel: string;
  detailLoading: boolean;
  detail: CountryDetail | null;
  form: Partial<CountryRow> | null;
  setForm: Dispatch<SetStateAction<Partial<CountryRow> | null>>;
  newDomain: string;
  setNewDomain: (s: string) => void;
  busyCode: string | null;
  saveCountryForm: () => void;
  addDomain: () => void;
  syncInstantly: () => void;
  syncMsg: string | null;
  webhookFull: string;
  luxuryPartnerBrands: string[];
}) {
  const t = useTranslations('Dashboard.adminGrowthWarRoom');
  const tRich = t.rich;
  const format = useFormatter();
  const countryLabelFn = useGrowthCountryLabel();
  const [missionProspectId, setMissionProspectId] = useState('');
  const [missionProduct, setMissionProduct] = useState('');
  const [missionBusy, setMissionBusy] = useState(false);
  const [missionMsg, setMissionMsg] = useState<string | null>(null);

  if (detailLoading || !detail || !form) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center text-sm text-zinc-500">
        {t('loadingMarket', { label: countryLabel })}
      </div>
    );
  }

  const s = detail.stats;

  const submitMissionValidation = async () => {
    const pid = missionProspectId.trim();
    if (!pid || !missionProduct) {
      setMissionMsg(t('missionValidationMissing'));
      return;
    }
    setMissionBusy(true);
    setMissionMsg(null);
    try {
      const r = await fetch('/api/admin/outreach-touch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId: pid,
          channel: 'mission_validation',
          subjectOrRef: t('missionValidationSubjectRef', { country: code }),
          metadata: {
            missionLuxuryProduct: missionProduct,
            tunnel: 'growth_war_room',
            countryCode: code,
          },
          setLastOutreach: true,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? t('missionValidationErr'));
      setMissionMsg(t('missionValidationOk'));
      setMissionProspectId('');
      setMissionProduct('');
    } catch (e) {
      setMissionMsg(e instanceof Error ? e.message : t('missionValidationErr'));
    } finally {
      setMissionBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('statProspects')} value={format.number(s.prospectsTotal)} />
        <StatCard label={t('statWithEmail')} value={format.number(s.prospectsWithEmail)} />
        <StatCard
          label={t('statOpenRate')}
          value={
            s.openRate != null ? format.number(s.openRate, PERCENT_ESTIMATE) : t('selectEmpty')
          }
        />
        <StatCard
          label={t('statClickRate')}
          value={
            s.clickRate != null ? format.number(s.clickRate, PERCENT_ESTIMATE) : t('selectEmpty')
          }
        />
      </div>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Building2 className="h-4 w-4 text-indigo-400" />
          {t('detailConfigTitle')}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t('localeTunnelLabel')}
            <input
              readOnly
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-300"
              value={form.localeDefault ?? ''}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t('capLabel')}
            <input
              type="number"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              value={form.dailyOutreachCap ?? 0}
              onChange={(e) =>
                setForm((f) => ({ ...f!, dailyOutreachCap: parseInt(e.target.value, 10) || 0 }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(form.publicSiteLocaleEnabled)}
              onChange={(e) =>
                setForm((f) => ({ ...f!, publicSiteLocaleEnabled: e.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-600"
            />
            {t('publishLocaleCheckbox')}
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(form.outreachEnabled)}
              onChange={(e) => setForm((f) => ({ ...f!, outreachEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-zinc-600"
            />
            {t('outreachActiveCheckbox')}
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t('providerLabel')}
            <select
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              value={form.outreachProvider ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f!,
                  outreachProvider: e.target.value || null,
                }))
              }
            >
              <option value="">{t('selectEmpty')}</option>
              {OUTREACH_PROVIDER_ROWS.map(({ value, labelKey }) => (
                <option key={value} value={value}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t('instantlyCampaignLabel')}
            <input
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
              value={form.instantlyCampaignId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f!, instantlyCampaignId: e.target.value || null }))}
              placeholder={t('instantlyPlaceholder')}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400 sm:col-span-2">
            {t('smartleadReserve')}
            <input
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
              value={form.smartleadCampaignId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f!, smartleadCampaignId: e.target.value || null }))}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          {t('notesLabel')}
          <textarea
            className="min-h-[72px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f!, notes: e.target.value || null }))}
          />
        </label>
        <button
          type="button"
          disabled={busyCode === code}
          onClick={() => void saveCountryForm()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {t('saveMarket')}
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-3">
        <h3 className="text-sm font-medium text-zinc-200">{t('domainsTitle', { country: countryLabel })}</h3>
        <ul className="space-y-1 font-mono text-xs text-zinc-400">
          {detail.domains.length === 0 ? (
            <li className="text-zinc-600">{t('noDomains')}</li>
          ) : (
            detail.domains.map((d) => (
              <li key={d.id}>
                <span className="text-zinc-200">{d.hostname}</span> · {d.status}
                {d.countryCode && d.countryCode !== code ? (
                  <span className="ml-2 text-amber-400">
                    {t('domainMismatchWarning', { label: countryLabelFn(d.countryCode) })}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
            placeholder={t('domainInputPlaceholder')}
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
          />
          <button
            type="button"
            disabled={busyCode === code}
            onClick={() => void addDomain()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            {t('addToCluster')}
          </button>
        </div>
      </section>

      {luxuryPartnerBrands.length > 0 ? (
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-5 space-y-3">
          <h3 className="text-sm font-medium text-emerald-200">{t('missionValidationTitle')}</h3>
          <p className="text-xs text-emerald-100/75">{t('missionValidationHelp')}</p>
          <p className="text-[11px] font-mono text-emerald-200/80">{luxuryPartnerBrands.join(' · ')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              {t('missionProspectIdLabel')}
              <input
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
                value={missionProspectId}
                onChange={(e) => setMissionProspectId(e.target.value)}
                placeholder={t('missionProspectIdPlaceholder')}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              {t('missionProductLabel')}
              <select
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                value={missionProduct}
                onChange={(e) => setMissionProduct(e.target.value)}
              >
                <option value="">{t('missionProductPlaceholder')}</option>
                {luxuryPartnerBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={missionBusy || busyCode === code}
            onClick={() => void submitMissionValidation()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {missionBusy ? t('missionValidationBusy') : t('missionValidationSubmit')}
          </button>
          {missionMsg ? <p className="text-xs text-zinc-400">{missionMsg}</p> : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Send className="h-4 w-4 text-indigo-400" />
          {t('pushInstantlyTitle')}
        </h3>
        <p className="text-xs text-zinc-500">
          {tRich('pushInstantlyBodyRich', {
            mono: (chunks) => <code className="text-zinc-400">{chunks}</code>,
          })}
        </p>
        <button
          type="button"
          disabled={busyCode === code}
          onClick={() => void syncInstantly()}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {t('pushBatch')}
        </button>
        {syncMsg ? <p className="text-xs text-zinc-400">{syncMsg}</p> : null}
      </section>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Scale className="h-4 w-4 text-violet-400" />
          {t('legalBabelHeading')}
        </h3>
        <p className="text-xs leading-relaxed text-zinc-500">
          {t('legalNoteP1')}
          <strong className="text-zinc-400">{t('legalNoteBrand')}</strong>
          {t('legalNoteP2')}
        </p>
        <Link
          href="/dashboard/admin"
          className="inline-block text-xs font-medium text-indigo-400 hover:text-indigo-300"
        >
          {t('adminHomeLink')}
        </Link>
        {webhookFull ? (
          <p className="pt-2 font-mono text-[10px] text-zinc-600 break-all">
            {t('webhookShortLabel')}
            {webhookFull}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-800/60 p-4">
        <p className="text-[11px] font-medium uppercase text-zinc-500">{t('prospectStatusHeading')}</p>
        <pre className="mt-2 overflow-x-auto text-xs text-zinc-400">
          {JSON.stringify(s.byStatus, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}
