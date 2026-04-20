import { Suspense } from 'react';
import { DashboardInlineLoading } from '@/components/dashboard/dashboard-inline-loading';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Link } from '@/i18n/navigation';
import { Shield, FileText, ChevronRight, FolderOpen, Sparkles, Headphones, Cpu, Archive, Radar, Languages, Stamp } from 'lucide-react';
import { AdminLegalWorkspace } from '@/components/admin/admin-legal-workspace';
import { SentinelPanel } from '@/components/admin/sentinel-panel';
import { AdminClientsSection } from '@/components/admin/admin-clients-section';
import { AdminStatsCards } from '@/components/admin/admin-stats-cards';
import { AdminSaasPulseStrip } from '@/components/admin/admin-saas-pulse-strip';
import { buildSaasKpisPayload } from '@/lib/admin/saas-kpis';
import { AdminInvestorDashboardRoadmap } from '@/components/admin/admin-investor-dashboard-roadmap';
import { AdminBlogForgePanel } from '@/components/admin/admin-blog-forge-panel';
import { Sentinel360FlashTrigger } from '@/components/admin/sentinel-360-flash';
import { AdminSecurityHubCard } from '@/components/admin/admin-security-hub-card';
import { ComplianceSentinelCard } from '@/components/admin/compliance-sentinel-card';
import { AdminHelpPastille } from '@/components/admin/admin-help-pastille';
import { AdminOpsStatusBar } from '@/components/admin/admin-ops-status-bar';
import { AdminHubModuleCard } from '@/components/admin/admin-dashboard-home-guides';
import {
  AdminCouncilDigestPanel,
  type CouncilDigestRow,
} from '@/components/admin/admin-council-digest-panel';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations({ locale, namespace: 'Dashboard.adminHub' });
  const intlTag = siteLocaleToIntlDateTag(locale);

  // — Vérification auth + rôle admin —
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (myProfile?.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  // — Requêtes admin via service role (bypass RLS) —
  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center bg-zinc-950 px-6 text-center">
        <p className="text-sm font-medium text-zinc-200">{tAdmin('configIncompleteTitle')}</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">{tAdmin('configIncompleteBody')}</p>
      </div>
    );
  }

  let totalUsers: number | null = 0;
  let totalAiReviews: number | null = 0;
  let totalLegalVersions: number | null = 0;
  let latestLegal: { id?: string; version: number; document_type: string; effective_date: string | null; summary_of_changes: string | null; published_at: string | null }[] = [];
  let guardianLastAt: string | null = null;
  let guardianStatus = 'idle';
  let guardianSummary: string | null = null;
  let pendingGuardianDrafts = 0;
  let lastSentinelVault: {
    run_at: string;
    status: string;
    error_message: string | null;
  } | null = null;
  let councilDigestRows: CouncilDigestRow[] = [];
  let saasPulseInitial: Awaited<ReturnType<typeof buildSaasKpisPayload>> = null;

  try {
    // Stats : total inscrits
    const { count: usersCount } = await adminSupabase
      .from('profiles')
      .select('id', { head: true, count: 'exact' });
    totalUsers = usersCount;

    // Stats : total avis traités par l'IA (ai_response NOT NULL)
    const { count: aiCount } = await adminSupabase
      .from('reviews')
      .select('id', { head: true, count: 'exact' })
      .not('ai_response', 'is', null);
    totalAiReviews = aiCount;

    // Stats : nombre de versions légales publiées
    const { count: legalCount } = await adminSupabase
      .from('legal_versioning')
      .select('id', { head: true, count: 'exact' });
    totalLegalVersions = legalCount;

    // Dernière version légale publiée
    const { data: latestLegalData } = await adminSupabase
      .from('legal_versioning')
      .select('id, version, document_type, effective_date, summary_of_changes, published_at')
      .order('version', { ascending: false })
      .limit(5);
    latestLegal = latestLegalData ?? [];

    const { data: guardianRow } = await adminSupabase
      .from('legal_guardian_state')
      .select('last_run_at, last_status, last_summary')
      .eq('id', 1)
      .maybeSingle();
    if (guardianRow) {
      guardianLastAt = guardianRow.last_run_at as string | null;
      guardianStatus = String(guardianRow.last_status ?? 'idle');
      guardianSummary = (guardianRow.last_summary as string | null) ?? null;
    }
    const { count: draftCount } = await adminSupabase
      .from('legal_guardian_drafts')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'pending_admin');
    pendingGuardianDrafts = draftCount ?? 0;

    const { data: vaultRow } = await adminSupabase
      .from('sentinel_vault_runs')
      .select('run_at, status, error_message')
      .order('run_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastSentinelVault = vaultRow ?? null;

    const { data: councilData, error: councilErr } = await adminSupabase
      .from('admin_council_digest')
      .select('id, created_at, transcript, consensus_note')
      .order('created_at', { ascending: false })
      .limit(5);
    if (councilErr) {
      console.warn('[admin page] admin_council_digest', councilErr);
    }
    if (!councilErr && councilData?.length) {
      councilDigestRows = councilData.map((r) => ({
        id: String(r.id),
        created_at: String(r.created_at),
        consensus_note: r.consensus_note != null ? String(r.consensus_note) : null,
        transcript: Array.isArray(r.transcript)
          ? (r.transcript as CouncilDigestRow['transcript']).map((t) => ({
              agent_key: String((t as { agent_key?: string }).agent_key ?? ''),
              label: String((t as { label?: string }).label ?? ''),
              message: String((t as { message?: string }).message ?? ''),
            }))
          : [],
      }));
    }

    if (adminSupabase && process.env.STRIPE_SECRET_KEY?.trim()) {
      try {
        saasPulseInitial = await buildSaasKpisPayload(adminSupabase);
      } catch (e) {
        console.warn('[admin page] saas pulse', e);
      }
    }
  } catch (err) {
    console.error('[admin page]', err);
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center bg-zinc-950 px-6 text-center">
        <p className="text-sm font-medium text-zinc-200">{tAdmin('dataUnavailableTitle')}</p>
        <p className="mt-2 max-w-md font-mono text-xs text-zinc-600">
          {err instanceof Error ? err.message : tAdmin('unknownError')}
        </p>
      </div>
    );
  }

  const adminSecret = process.env.ADMIN_SECRET ?? '';
  const tKit = await getTranslations({ locale, namespace: 'Dashboard.adminComplianceKit' });

  const docBadge = (dt: string) => {
    if (dt === 'cgu') return tAdmin('docBadgeCgu');
    if (dt === 'politique_confidentialite') return tAdmin('docBadgePrivacy');
    if (dt === 'mentions_legales') return tAdmin('docBadgeLegal');
    return dt;
  };

  return (
    <div className="min-h-full bg-zinc-950 text-white">
      <header className="border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-800/90 bg-zinc-900/50 shadow-inner shadow-black/25">
              <Shield className="h-5 w-5 text-zinc-100" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{tAdmin('headerTitle')}</h1>
              <p className="mt-0.5 text-xs text-zinc-500">{tAdmin('headerSubtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Sentinel360FlashTrigger />
            <span className="hidden items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-900/30 px-3 py-1.5 text-[11px] font-medium text-zinc-500 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/90" aria-hidden />
              {tAdmin('sessionBadge')}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <AdminOpsStatusBar
          vaultLastStatus={lastSentinelVault?.status ?? null}
          guardianStatus={guardianStatus}
          pendingGuardianDrafts={pendingGuardianDrafts}
        />

        <AdminCouncilDigestPanel rows={councilDigestRows} locale={locale} />

        {lastSentinelVault?.status === 'failed' ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/45 bg-red-950/35 px-4 py-3 flex gap-3 items-start"
          >
            <Shield className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-100">{tAdmin('vaultFailTitle')}</p>
              <p className="text-xs text-red-200/85 mt-1">
                {lastSentinelVault.error_message || tAdmin('vaultFailBodyFallback')}
              </p>
              <p className="text-[10px] text-red-300/70 font-mono mt-1">
                {tAdmin('vaultLastRunUtc', {
                  datetime: new Date(lastSentinelVault.run_at).toLocaleString(intlTag, { timeZone: 'UTC' }),
                })}
              </p>
            </div>
          </div>
        ) : null}

        {/* Sentinel — état système & sonde (au-dessus des outils) */}
        <section id="sentinel-panel" className="scroll-mt-8">
          <SentinelPanel />
        </section>

        <section className="space-y-3">
          <h2 className="text-[13px] font-medium text-zinc-400">{tAdmin('toolsHeading')}</h2>
          <div className="space-y-3">
            <AdminSecurityHubCard />

            <AdminHubModuleCard>
              <Link
                href="/dashboard/admin/settings"
                className="group flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-950/35">
                  <Stamp className="h-5 w-5 text-amber-400/95" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-zinc-100">{tAdmin('brandSealTitle')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{tAdmin('brandSealDesc')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </Link>
            </AdminHubModuleCard>

            <AdminHubModuleCard>
              <Link
                href="/dashboard/admin/growth-war-room"
                className="group flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-950/35">
                  <Radar className="h-5 w-5 text-indigo-400/95" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-zinc-100">{tAdmin('growthTitle')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{tAdmin('growthDesc')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </Link>
            </AdminHubModuleCard>

            <AdminHubModuleCard>
              <Link
                href="/dashboard/admin/babel-guardian"
                className="group flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/40 bg-violet-950/35">
                  <Languages className="h-5 w-5 text-violet-400/95" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-zinc-100">{tAdmin('babelTitle')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{tAdmin('babelDesc')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </Link>
            </AdminHubModuleCard>

            <AdminHubModuleCard>
              <Link
                href="/dashboard/admin/black-box-archive"
                className="group flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/40">
                  <Archive className="h-5 w-5 text-sky-400/90" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="inline-flex items-center gap-1 text-sm font-medium text-zinc-100">
                    {tAdmin('blackBoxTitle')}
                    <AdminHelpPastille text={tAdmin('blackBoxHelp')} />
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{tAdmin('blackBoxDesc')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </Link>
            </AdminHubModuleCard>

            <AdminHubModuleCard>
              <Link
                href="/dashboard/admin/ia-forge"
                className="group flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/40">
                  <Cpu className="h-5 w-5 text-fuchsia-400/90" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="inline-flex items-center gap-1 text-sm font-medium text-zinc-100">
                    {tAdmin('forgeTitle')}
                    <AdminHelpPastille text={tAdmin('forgeHelp')} />
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{tAdmin('forgeDesc')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </Link>
            </AdminHubModuleCard>

            <AdminHubModuleCard>
              <Link
                href="/dashboard/admin/nexus-support"
                className="group flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/40">
                  <Headphones className="h-5 w-5 text-violet-400/90" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="inline-flex items-center gap-1 text-sm font-medium text-zinc-100">
                    {tAdmin('nexusTitle')}
                    <AdminHelpPastille text={tAdmin('nexusHelp')} />
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{tAdmin('nexusDesc')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </Link>
            </AdminHubModuleCard>

            <AdminHubModuleCard>
              <Link
                href="/dashboard/admin/code-guardian"
                className="group flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/40">
                  <Sparkles className="h-5 w-5 text-indigo-400/90" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-zinc-100">{tAdmin('codeGuardianTitle')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{tAdmin('codeGuardianDesc')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </Link>
            </AdminHubModuleCard>

            <AdminHubModuleCard>
              <Link
                href="/dashboard/admin/compliance-audit-kit"
                className="group flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/40">
                  <FolderOpen className="h-5 w-5 text-emerald-400/90" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="inline-flex flex-wrap items-center gap-1 text-sm font-medium text-zinc-100">
                    {tKit('adminCardTitle')}
                    <AdminHelpPastille text={tAdmin('complianceKitHelp')} />
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{tKit('adminCardDescription')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </Link>
            </AdminHubModuleCard>
          </div>
        </section>

        <ComplianceSentinelCard
          lastGuardianAt={guardianLastAt}
          guardianStatus={guardianStatus}
          pendingDraftsCount={pendingGuardianDrafts}
          lastSummary={guardianSummary}
        />

        <AdminSaasPulseStrip initial={saasPulseInitial} />

        <AdminStatsCards
          initial={{
            totalUsers: totalUsers ?? 0,
            totalAiReviews: totalAiReviews ?? 0,
            totalLegalVersions: totalLegalVersions ?? 0,
          }}
        />

        <div id="admin-clients" className="scroll-mt-8 min-w-0 max-w-full">
          <Suspense fallback={<DashboardInlineLoading />}>
            <AdminClientsSection />
          </Suspense>
        </div>

        <AdminInvestorDashboardRoadmap />

        {adminSecret ? <AdminBlogForgePanel adminSecret={adminSecret} /> : null}

        {/* ── Historique versions légales ── */}
        {latestLegal && latestLegal.length > 0 && (
          <section>
            <h2 className="mb-4 text-[13px] font-medium text-zinc-400">{tAdmin('legalHistoryTitle')}</h2>
            <div className="divide-y divide-zinc-800/60 overflow-hidden rounded-2xl border border-zinc-800/60">
              {latestLegal.map((lv) => (
                <div key={lv.id ?? `${lv.document_type}-${lv.version}`} className="flex items-start gap-4 px-5 py-4 hover:bg-zinc-900/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono font-bold text-zinc-300">{`v${lv.version}`}</span>
                      <span className="px-2 py-0 rounded-md bg-zinc-800 border border-zinc-700/60 text-zinc-400 text-[11px] font-medium">
                        {docBadge(lv.document_type)}
                      </span>
                      <span className="text-zinc-600 text-xs">
                        {tAdmin('effectivePrefix', {
                          date: lv.effective_date ?? tAdmin('emDash'),
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 truncate">{lv.summary_of_changes ?? ''}</p>
                  </div>
                  <span className="text-[11px] text-zinc-600 font-mono flex-shrink-0">
                    {lv.published_at
                      ? new Date(lv.published_at).toLocaleDateString(intlTag)
                      : tAdmin('emDash')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Publier nouvelle version légale ── */}
        <section id="legal-publish">
          <AdminHubModuleCard>
            <div className="px-1 py-1 sm:px-2">
              <AdminLegalWorkspace adminSecret={adminSecret} />
            </div>
          </AdminHubModuleCard>
        </section>
      </div>
    </div>
  );
}
