import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shield, Download, FileText, Bot, Globe, MapPin } from 'lucide-react';
import { AdminSubpageHeader } from '@/components/admin/admin-subpage-header';
import {
  COMPLIANCE_ZONES,
  type ZoneComplianceStatus,
  consentUpliftByZone,
} from '@/lib/legal/compliance-zones';
import { formatComplianceLogNarrative } from '@/lib/legal/compliance-log-narrative';
import { ComplianceGuardianDraftRow } from '@/components/admin/compliance-guardian-draft-row';

export const dynamic = 'force-dynamic';

const ZONE_MSG_KEY: Record<ZoneComplianceStatus, 'zone_ok' | 'zone_watch' | 'zone_action_required' | 'zone_local_specific'> =
  {
    ok: 'zone_ok',
    watch: 'zone_watch',
    action_required: 'zone_action_required',
    local_specific: 'zone_local_specific',
  };

/** En-têtes HTTP (noms techniques, hors copy) — hors JSX pour eslint-plugin-i18next */
const HTTP_HDR_VERCEL_IP_COUNTRY = 'x-vercel-ip-country';
const HTTP_HDR_CF_IPCOUNTRY = 'cf-ipcountry';
/** Case à cocher tableau consentements (symbole unique, pas une phrase) */
const CONSENT_TABLE_CHECK = '\u2713';
const ZONE_STATUS_FALLBACK: ZoneComplianceStatus = 'ok';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminCompliancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Dashboard.adminCompliance' });
  const tNav = await getTranslations({ locale, namespace: 'Dashboard.adminNav' });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((myProfile as { role?: string } | null)?.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  const admin = createAdminClient();
  if (!admin) {
    return (
      <div className="min-h-full bg-zinc-950 flex items-center justify-center p-8">
        <p className="text-red-400 text-sm">{t('supabaseMissing')}</p>
      </div>
    );
  }

  const [{ data: guardian }, { data: drafts }, { data: logs }, { data: consentRows }, { data: consentRecent }] =
    await Promise.all([
      admin.from('legal_guardian_state').select('*').eq('id', 1).maybeSingle(),
      admin
        .from('legal_guardian_drafts')
        .select('id, document_type, status, summary_of_changes, created_at, admin_verified_at')
        .eq('status', 'pending_admin')
        .order('created_at', { ascending: false })
        .limit(10),
      admin
        .from('legal_compliance_logs')
        .select('id, event_type, message, metadata, legal_version, created_at')
        .order('created_at', { ascending: false })
        .limit(60),
      admin.from('user_consents').select('country, consent_status'),
      admin
        .from('user_consents')
        .select(
          'id, consent_status, country, ui_locale, navigator_language, accept_language, user_id, anonymous_id, legal_version_id, analytics_opt_in, marketing_opt_in, gpc_signal_observed, updated_at, created_at'
        )
        .order('updated_at', { ascending: false })
        .limit(50),
    ]);

  const byCountry: Record<
    string,
    { all: number; necessary: number; refused: number; partial: number; total: number }
  > = {};
  for (const row of consentRows ?? []) {
    const c = String((row as { country?: string }).country ?? 'ZZ');
    const st = String((row as { consent_status?: string }).consent_status ?? '');
    if (!byCountry[c]) byCountry[c] = { all: 0, necessary: 0, refused: 0, partial: 0, total: 0 };
    byCountry[c].total++;
    if (st === 'all') byCountry[c].all++;
    else if (st === 'necessary') byCountry[c].necessary++;
    else if (st === 'refused') byCountry[c].refused++;
    else if (st === 'partial') byCountry[c].partial++;
  }

  const g = guardian as Record<string, unknown> | null;
  const lastRun = g?.last_run_at ? new Date(String(g.last_run_at)) : null;
  const daysAgo =
    lastRun != null ? Math.floor((Date.now() - lastRun.getTime()) / (24 * 3600 * 1000)) : null;
  const statusLabel = String(g?.last_status ?? 'idle');
  const conforme = statusLabel === 'ok' || statusLabel === 'idle';

  const byCountryLift: Record<string, { total: number; all: number }> = {};
  for (const [c, s] of Object.entries(byCountry)) {
    byCountryLift[c] = { total: s.total, all: s.all };
  }
  const zoneLift = consentUpliftByZone(byCountryLift);
  const rawZoneMap = g?.compliance_zones as Record<string, ZoneComplianceStatus> | undefined;
  const zoneMap: Record<string, ZoneComplianceStatus> =
    rawZoneMap && typeof rawZoneMap === 'object' && !Array.isArray(rawZoneMap) ? rawZoneMap : {};

  function zoneCardClass(st: ZoneComplianceStatus): string {
    switch (st) {
      case 'ok':
        return 'border-emerald-500/25 bg-emerald-500/[0.07]';
      case 'watch':
        return 'border-sky-500/25 bg-sky-500/[0.06]';
      case 'action_required':
        return 'border-amber-500/35 bg-amber-500/[0.08]';
      case 'local_specific':
        return 'border-orange-500/45 bg-orange-500/[0.09]';
      default:
        return 'border-zinc-800/80 bg-zinc-900/40';
    }
  }

  return (
    <div className="min-h-full bg-zinc-950 text-white pb-16">
      <AdminSubpageHeader
        title={t('headerTitle')}
        badge={t('headerBadge')}
        subtitle={t('headerSubtitle')}
        backLabel={tNav('backToAdmin')}
        icon={<Shield className="h-5 w-5 text-emerald-400/90" strokeWidth={1.75} />}
        actions={
          <>
            <a
              href="/api/admin/compliance/export"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-900/40 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <Download className="h-3.5 w-3.5" />
              {t('exportCsv')}
            </a>
            <a
              href="/api/admin/compliance/audit-export"
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/35 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-100 transition-colors hover:border-violet-400/45 hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <FileText className="h-3.5 w-3.5" />
              {t('exportAuditJson')}
            </a>
          </>
        }
      />

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-200">{t('guardianTitle')}</h2>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {lastRun && daysAgo != null ? (
              <>
                {t('guardianLine1')}{' '}
                <strong className="text-zinc-200">{daysAgo}</strong>{' '}
                {t('guardianDayWord', { count: daysAgo })}. {t('guardianStatusIntro')}{' '}
                <span className={conforme ? 'text-emerald-400' : 'text-amber-400'}>
                  {conforme ? t('guardianStatusOk') : statusLabel}
                </span>
                .
              </>
            ) : (
              <>{t('guardianNoCron')}</>
            )}
          </p>
          {g?.last_summary ? (
            <p className="mt-3 text-xs text-zinc-500 border-t border-zinc-800/80 !mt-4 !pt-4">{String(g.last_summary)}</p>
          ) : null}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-orange-400" />
            <h2 className="text-sm font-semibold text-zinc-200">{t('zonesTitle')}</h2>
          </div>
          <p className="text-xs text-zinc-500 mb-4 max-w-3xl">{t('zonesIntro')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMPLIANCE_ZONES.map((z) => {
              const st = zoneMap[z.id] ?? ZONE_STATUS_FALLBACK;
              const lift = zoneLift[z.id];
              return (
                <div
                  key={z.id}
                  className={`rounded-xl border px-4 py-3 transition-colors ${zoneCardClass(st)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-zinc-500">{z.shortLabel}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                        st === 'ok'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : st === 'local_specific'
                            ? 'bg-orange-500/15 text-orange-300'
                            : st === 'action_required'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-sky-500/15 text-sky-300'
                      }`}
                    >
                      {t(ZONE_MSG_KEY[st])}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-200 mt-1 leading-snug">{z.label}</p>
                  {z.id !== 'edpb_eu' && lift ? (
                    <p className="text-[11px] text-zinc-500 mt-2">
                      {t('zoneCookiesLabel')}{' '}
                      <span className="text-zinc-400">
                        {lift.total
                          ? t('zoneVisitsFmt', { pct: lift.pctAll, count: lift.total })
                          : t('zoneNoData')}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-zinc-600 mt-2">{t('zoneEuNote')}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {drafts && drafts.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('draftsTitle')}
            </h2>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 divide-y divide-amber-500/10">
              {drafts.map((d) => (
                <ComplianceGuardianDraftRow
                  key={String((d as { id: string }).id)}
                  draft={{
                    id: String((d as { id: string }).id),
                    document_type: String((d as { document_type: string }).document_type),
                    summary_of_changes: String((d as { summary_of_changes?: string }).summary_of_changes ?? ''),
                    created_at: String((d as { created_at: string }).created_at),
                    admin_verified_at:
                      (d as { admin_verified_at?: string | null }).admin_verified_at != null
                        ? String((d as { admin_verified_at: string }).admin_verified_at)
                        : null,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-200">{t('consentTraceTitle')}</h2>
          </div>
          <p className="text-xs text-zinc-500 mb-3 max-w-3xl">
            {t('consentTraceP1')}
            <code className="text-zinc-400">{t('consentTraceNavCode')}</code>
            {t('consentTraceP2')}
            <strong className="text-zinc-400 font-normal">{t('consentTraceP3')}</strong>
            {t('consentTraceP4')}
            <code className="text-zinc-400">{HTTP_HDR_VERCEL_IP_COUNTRY}</code>
            {t('consentTraceP5')}
            <code className="text-zinc-400">{HTTP_HDR_CF_IPCOUNTRY}</code>
            {t('consentTraceP6')}
          </p>
          <div className="rounded-2xl border border-zinc-800/80 overflow-x-auto mb-10">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-zinc-800/80 text-left text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="px-3 py-2.5">{t('thMaj')}</th>
                  <th className="px-3 py-2.5">{t('thStatut')}</th>
                  <th className="px-3 py-2.5">{t('thPays')}</th>
                  <th className="px-3 py-2.5">{t('thUi')}</th>
                  <th className="px-3 py-2.5">{t('thNavigateur')}</th>
                  <th className="px-3 py-2.5">{t('thAcceptLang')}</th>
                  <th className="px-3 py-2.5">{t('thAnalytique')}</th>
                  <th className="px-3 py-2.5">{t('thMarketing')}</th>
                  <th className="px-3 py-2.5">{t('thGpc')}</th>
                  <th className="px-3 py-2.5">{t('thVLegal')}</th>
                  <th className="px-3 py-2.5">{t('thSujet')}</th>
                </tr>
              </thead>
              <tbody>
                {(consentRecent ?? []).map((raw) => {
                  const row = raw as {
                    id: string;
                    consent_status: string;
                    country: string;
                    ui_locale?: string | null;
                    navigator_language?: string | null;
                    accept_language?: string | null;
                    user_id?: string | null;
                    anonymous_id?: string | null;
                    legal_version_id?: number | null;
                    analytics_opt_in?: boolean | null;
                    marketing_opt_in?: boolean | null;
                    gpc_signal_observed?: boolean | null;
                    updated_at: string;
                  };
                  const subj = row.user_id
                    ? t('subjectUser', { prefix: String(row.user_id).slice(0, 8) })
                    : row.anonymous_id
                      ? t('subjectAnon', { prefix: String(row.anonymous_id).slice(0, 8) })
                      : t('emDash');
                  return (
                    <tr key={String(row.id)} className="border-b border-zinc-800/40 hover:bg-zinc-900/40">
                      <td className="px-3 py-2 text-[11px] text-zinc-500 whitespace-nowrap font-mono">
                        {new Date(row.updated_at).toISOString().slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-300">{row.consent_status}</td>
                      <td
                        className="px-3 py-2 font-mono text-zinc-400"
                        title={
                          String(row.country).toUpperCase() === 'ZZ' ? t('zzTitleCell') : undefined
                        }
                      >
                        {String(row.country).toUpperCase() === 'ZZ' ? (
                          <span className="text-zinc-500">
                            ZZ <span className="text-[10px] text-zinc-600 font-sans">{t('zzUnknown')}</span>
                          </span>
                        ) : (
                          row.country
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-sky-400/90">
                        {row.ui_locale && String(row.ui_locale).trim() ? row.ui_locale : t('emDash')}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-zinc-400 max-w-[120px] truncate" title={String(row.navigator_language ?? '')}>
                        {row.navigator_language && String(row.navigator_language).trim() ? row.navigator_language : t('emDash')}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-zinc-500 max-w-[140px] truncate" title={String(row.accept_language ?? '')}>
                        {row.accept_language && String(row.accept_language).trim() ? row.accept_language : t('emDash')}
                      </td>
                      <td className="px-3 py-2 text-center text-zinc-300">
                        {row.analytics_opt_in ? CONSENT_TABLE_CHECK : t('emDash')}
                      </td>
                      <td className="px-3 py-2 text-center text-zinc-300">
                        {row.marketing_opt_in ? CONSENT_TABLE_CHECK : t('emDash')}
                      </td>
                      <td className="px-3 py-2 text-center text-zinc-300">
                        {row.gpc_signal_observed ? CONSENT_TABLE_CHECK : t('emDash')}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">{row.legal_version_id ?? t('emDash')}</td>
                      <td className="px-3 py-2 text-[11px] text-zinc-500 font-mono">{subj}</td>
                    </tr>
                  );
                })}
                {(!consentRecent || consentRecent.length === 0) && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-zinc-600 text-sm">
                      {t('noConsentRows')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-semibold text-zinc-200">{t('acceptCountryTitle')}</h2>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/80 text-left text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">{t('thPays')}</th>
                  <th className="px-4 py-3">{t('thTotal')}</th>
                  <th className="px-4 py-3">{t('thToutAccepter')}</th>
                  <th className="px-4 py-3">{t('thNecessary')}</th>
                  <th className="px-4 py-3">{t('thRefus')}</th>
                  <th className="px-4 py-3">{t('thPartiel')}</th>
                  <th className="px-4 py-3">{t('thPctTout')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byCountry)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([country, s]) => (
                    <tr key={country} className="border-b border-zinc-800/40 hover:bg-zinc-900/40">
                      <td className="px-4 py-3 font-mono text-zinc-300">
                        {country.toUpperCase() === 'ZZ' ? (
                          <span title={t('zzTitleRow')}>
                            ZZ <span className="text-[11px] text-zinc-600 font-sans">{t('zzUnknown')}</span>
                          </span>
                        ) : (
                          country
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{s.total}</td>
                      <td className="px-4 py-3 text-emerald-400/90">{s.all}</td>
                      <td className="px-4 py-3 text-sky-400/90">{s.necessary}</td>
                      <td className="px-4 py-3 text-amber-400/90">{s.refused}</td>
                      <td className="px-4 py-3 text-violet-400/90">{s.partial}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {s.total ? Math.round((s.all / s.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                {Object.keys(byCountry).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-600 text-sm">
                      {t('noUserConsents')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            {t('auditTitle', { locale })}
          </h2>
          <p className="text-xs text-zinc-600 mb-3 max-w-3xl">{t('auditIntro')}</p>
          <div className="rounded-2xl border border-zinc-800/80 divide-y divide-zinc-800/60 max-h-[480px] overflow-y-auto">
            {(logs ?? []).map((row) => {
              const r = row as {
                id: string;
                event_type: string;
                message: string | null;
                metadata: Record<string, unknown> | null;
                legal_version: number | null;
                created_at: string;
              };
              return (
                <div key={String(r.id)} className="px-5 py-3 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-violet-300">
                      {String(r.event_type)}
                    </span>
                    {r.legal_version != null ? (
                      <span className="text-[11px] text-zinc-500">{`v${String(r.legal_version)}`}</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {formatComplianceLogNarrative(r, locale)}
                  </p>
                  {r.metadata && typeof r.metadata === 'object' && Array.isArray((r.metadata as { sources_sample?: unknown }).sources_sample) ? (
                    <p className="text-[10px] font-mono text-zinc-600 break-all line-clamp-2">
                      {(r.metadata as { sources_sample: string[] }).sources_sample.slice(0, 3).join(' · ')}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
