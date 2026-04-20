import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import { merchantShouldSeeUpgrade } from '@/lib/subscription/merchant-paywall';
import { TerminalMobileShell } from '@/components/banano/terminal-mobile-shell';
import { getDefaultEstablishmentName } from '@/src/lib/empire-settings';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard.whatsappReviewMeta' });
  return {
    title: t('terminalSeoTitle'),
    description: t('terminalSeoDescription'),
    appleWebApp: {
      capable: true,
      title: t('terminalAppleWebTitle'),
      statusBarStyle: 'black-translucent',
    },
  };
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function TerminalLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/terminal`)}`);
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'subscription_status, trial_ends_at, trial_started_at, subscription_period_end, subscription_plan, selected_plan, legal_compliance_accepted, establishment_name'
    )
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    redirect(`/${locale}/dashboard`);
  }

  if (
    merchantShouldSeeUpgrade({
      subscription_status: profile.subscription_status as string | null,
      trial_ends_at: profile.trial_ends_at as string | null,
      trial_started_at: profile.trial_started_at as string | null,
      subscription_period_end: profile.subscription_period_end as string | null,
    })
  ) {
    redirect(`/${locale}/upgrade`);
  }

  const plan = toPlanSlug(
    profile.subscription_plan as string | null,
    profile.selected_plan as string | null
  );
  if (plan !== 'zenith') {
    redirect(`/${locale}/dashboard`);
  }

  if ((profile as Record<string, unknown>).legal_compliance_accepted !== true) {
    redirect(`/${locale}/dashboard/whatsapp-review`);
  }

  const tShell = await getTranslations({ locale, namespace: 'Dashboard.whatsappReviewMeta' });

  const label =
    (profile.establishment_name as string | null)?.trim() || getDefaultEstablishmentName();

  return (
    <TerminalMobileShell>
      <div className="banano-terminal-shell min-h-0 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#030303] text-slate-900 dark:text-slate-50">
        <header className="shrink-0 flex items-center justify-center gap-3 px-3 sm:px-4 py-3 border-b border-slate-200/90 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
          <div className="min-w-0 w-full max-w-full text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563eb]">
              {tShell('terminalHeaderBadge')}
            </p>
            <p className="text-sm font-semibold truncate" title={label}>
              {label}
            </p>
          </div>
        </header>
        <main
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y [touch-action:pan-y] [-webkit-overflow-scrolling:touch] scroll-smooth"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </main>
      </div>
    </TerminalMobileShell>
  );
}
