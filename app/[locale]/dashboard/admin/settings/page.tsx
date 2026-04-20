import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { ChevronLeft, Stamp } from 'lucide-react';
import { AdminBrandSealPanel } from '@/components/admin/admin-brand-seal-panel';
import { AGENCY_BRAND_CONFIG, type AgencyJurisdiction } from '@/lib/agency-brand-config';

export const dynamic = 'force-dynamic';

const REGISTRATION_LABEL_KEYS = {
  FR: 'registrationLabels.FR',
  IT: 'registrationLabels.IT',
  ES: 'registrationLabels.ES',
  DE: 'registrationLabels.DE',
  PT: 'registrationLabels.PT',
  JP: 'registrationLabels.JP',
  GB: 'registrationLabels.GB',
  US: 'registrationLabels.US',
  OTHER: 'registrationLabels.OTHER',
} as const satisfies Record<AgencyJurisdiction, string>;

type Props = { params: Promise<{ locale: string }> };

export default async function AdminBrandSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Dashboard.adminBrandSettings' });
  const tNav = await getTranslations({ locale, namespace: 'Dashboard.adminNav' });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect(`/${locale}/dashboard`);

  const registrationLabel = t(REGISTRATION_LABEL_KEYS[AGENCY_BRAND_CONFIG.jurisdiction]);

  return (
    <div className="min-h-full bg-zinc-950 text-white">
      <header className="border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
            >
              <ChevronLeft className="h-4 w-4" />
              {tNav('backToAdmin')}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-950/40 shadow-inner shadow-black/30">
              <Stamp className="h-5 w-5 text-amber-300/95" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{t('pageTitle')}</h1>
              <p className="text-xs text-zinc-500">{t('pageSubtitle')}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/25 p-6 sm:p-8">
          <h2 className="text-base font-semibold tracking-tight text-zinc-100">{t('sectionTitle')}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">{t('sectionLead')}</p>
          <div className="mt-8">
            <AdminBrandSealPanel registrationLabel={registrationLabel} />
          </div>
        </section>
      </div>
    </div>
  );
}
