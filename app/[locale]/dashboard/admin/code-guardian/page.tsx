import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Sparkles } from 'lucide-react';
import { AdminSubpageHeader } from '@/components/admin/admin-subpage-header';
import { CodeGuardianClient } from '@/components/admin/code-guardian-client';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminCodeGuardianPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tChrome = await getTranslations({ locale, namespace: 'Dashboard.adminSubpageChrome' });
  const tNav = await getTranslations({ locale, namespace: 'Dashboard.adminNav' });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="min-h-full bg-zinc-950 text-white">
      <AdminSubpageHeader
        title={tChrome('codeGuardianTitle')}
        badge={tChrome('codeGuardianBadge')}
        subtitle={tChrome('codeGuardianSubtitle')}
        backLabel={tNav('backToAdmin')}
        icon={<Sparkles className="h-5 w-5" strokeWidth={1.75} />}
      />
      <div className="px-4 py-8 sm:px-6">
        <CodeGuardianClient showBackLinks={false} />
      </div>
    </div>
  );
}
