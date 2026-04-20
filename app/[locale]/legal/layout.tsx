import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/** Toujours recalculer : contenu depuis legal_versioning selon la date UTC du jour J. */
export const dynamic = 'force-dynamic';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Portail légal : utilisateurs connectés sans validation RGPD (dashboard) ne voient pas le texte des pages légales.
 * Les visiteurs non connectés conservent l’accès public (lecture des CGU avant inscription).
 */
export default async function LegalSectionLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Legal' });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <>{children}</>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('legal_compliance_accepted')
    .eq('id', user.id)
    .maybeSingle();

  const ok = (profile as { legal_compliance_accepted?: boolean } | null)?.legal_compliance_accepted === true;
  if (ok) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-16 bg-slate-50 dark:bg-[#09090b]">
      <div className="max-w-lg text-center space-y-6 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/25 px-8 py-10">
        <p className="text-4xl" aria-hidden>
          🔒
        </p>
        <p className="text-slate-800 dark:text-slate-200 text-base leading-relaxed font-medium">
          {t('layoutComplianceGateMessage')}
        </p>
        <Link
          href="/dashboard/whatsapp-review?tab=collecte"
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-xl font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition-colors"
        >
          {t('layoutComplianceGateCta')}
        </Link>
      </div>
    </div>
  );
}
