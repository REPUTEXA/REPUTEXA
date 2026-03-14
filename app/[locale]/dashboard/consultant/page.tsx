import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import { hasFeature, FEATURES } from '@/lib/feature-gate';
import { StrategicConsultantChat } from '@/components/dashboard/strategic-consultant-chat';
import { Sparkles, ArrowRight, MessageSquare } from 'lucide-react';

type Props = {
  params: Promise<{ locale: string }>;
};

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Consultant Stratégique | REPUTEXA',
  description: 'Votre consultant IA 24/7 pour la stratégie e-réputation.',
};

export default async function ConsultantPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let planSlug: 'vision' | 'pulse' | 'zenith' = 'vision';
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, selected_plan')
      .eq('id', user.id)
      .single();
    planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
  }

  const canAccess = hasFeature(planSlug, FEATURES.CONSULTANT_CHAT);

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 max-w-[1000px] mx-auto relative z-10 flex flex-col min-h-[calc(100vh-200px)]">
      <header className="mb-6">
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-50">
          Votre Consultant Stratégique Zenith
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Posez vos questions sur votre réputation et votre stratégie 24/7.
        </p>
      </header>

      {canAccess ? (
        <div className="flex-1 flex flex-col min-h-0">
          <StrategicConsultantChat planSlug={planSlug} fullPage />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_0_24px_-8px_rgba(59,130,246,0.12)] dark:shadow-[0_0_24px_-8px_rgba(0,0,0,0.3)] p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 mb-6">
              <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-slate-50 mb-2">
              Consultant Stratégique — Réservé ZENITH
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
              Accédez à un conseiller IA 24/7 qui analyse vos avis et rapports pour vous prodiguer des recommandations
              ultra-concrètes. Le plan ZENITH vous offre ce niveau d&apos;accompagnement personnalisé.
            </p>
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Passer à ZENITH
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
