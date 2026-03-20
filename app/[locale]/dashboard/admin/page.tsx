import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shield, Users, Star, FileText, ChevronRight } from 'lucide-react';
import { LegalPublishForm } from '@/components/admin/legal-publish-form';
import { SentinelPanel } from '@/components/admin/sentinel-panel';
import { AdminClientsSection } from '@/components/admin/admin-clients-section';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

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
      <div className="min-h-full bg-zinc-950 flex items-center justify-center p-8">
        <p className="text-red-400 text-sm">Supabase admin client non configuré.</p>
      </div>
    );
  }

  let totalUsers: number | null = 0;
  let totalAiReviews: number | null = 0;
  let totalLegalVersions: number | null = 0;
  let latestLegal: { id?: string; version: number; document_type: string; effective_date: string | null; summary_of_changes: string | null; published_at: string | null }[] = [];

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
  } catch (err) {
    console.error('[admin page]', err);
    return (
      <div className="min-h-full bg-zinc-950 flex flex-col items-center justify-center p-8">
        <p className="text-red-400 text-sm mb-2">Erreur lors du chargement des données admin.</p>
        <p className="text-zinc-500 text-xs">{err instanceof Error ? err.message : 'Erreur inconnue'}</p>
      </div>
    );
  }

  const adminSecret = process.env.ADMIN_SECRET ?? '';

  const statsCards = [
    {
      label: 'Utilisateurs inscrits',
      value: totalUsers ?? 0,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Avis traités par l\'IA',
      value: totalAiReviews ?? 0,
      icon: Star,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
    },
    {
      label: 'Documents légaux publiés',
      value: totalLegalVersions ?? 0,
      icon: FileText,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  const docTypeLabels: Record<string, string> = {
    cgu: 'CGU',
    politique_confidentialite: 'Confidentialité',
    mentions_legales: 'Mentions légales',
  };

  return (
    <div className="min-h-full bg-zinc-950 text-white">
      {/* ── Header ── */}
      <div className="border-b border-zinc-800/80 bg-zinc-900/50 px-6 py-6 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Panel Administrateur
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[11px] font-semibold uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                REPUTEXA Internal — Accès restreint
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-600 font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Connecté en tant qu&apos;admin
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Stats ── */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
            Statistiques globales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statsCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className={`rounded-2xl border ${bg} px-5 py-4 flex items-center gap-4`}
              >
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {value.toLocaleString('fr-FR')}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Clients (pagination + recherche côté serveur) ── */}
        <AdminClientsSection />

        {/* ── Historique versions légales ── */}
        {latestLegal && latestLegal.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
              Historique légal (5 dernières versions)
            </h2>
            <div className="rounded-2xl border border-zinc-800/80 divide-y divide-zinc-800/60">
              {latestLegal.map((lv) => (
                <div key={lv.id ?? `${lv.document_type}-${lv.version}`} className="flex items-start gap-4 px-5 py-4 hover:bg-zinc-900/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono font-bold text-zinc-300">
                        v{lv.version}
                      </span>
                      <span className="px-2 py-0 rounded-md bg-zinc-800 border border-zinc-700/60 text-zinc-400 text-[11px] font-medium">
                        {docTypeLabels[lv.document_type] ?? lv.document_type}
                      </span>
                      <span className="text-zinc-600 text-xs">
                        Vigueur : {lv.effective_date ?? '—'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 truncate">{lv.summary_of_changes ?? ''}</p>
                  </div>
                  <span className="text-[11px] text-zinc-600 font-mono flex-shrink-0">
                    {lv.published_at ? new Date(lv.published_at).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Sentinel — État du système ── */}
        <SentinelPanel />

        {/* ── Publier nouvelle version légale ── */}
        <section>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
              <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-600/25 flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">
                  Publier une nouvelle version légale
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Un email de notification sera envoyé à tous les utilisateurs. Une modale de consentement s&apos;affichera à leur prochaine connexion.
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 ml-auto flex-shrink-0" />
            </div>
            <div className="px-5 py-5">
              <LegalPublishForm adminSecret={adminSecret} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
