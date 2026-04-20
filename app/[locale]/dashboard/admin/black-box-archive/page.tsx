import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Archive } from 'lucide-react';
import { AdminSubpageHeader } from '@/components/admin/admin-subpage-header';
import { BlackBoxArchiveClient } from '@/components/admin/black-box-archive-client';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminBlackBoxArchivePage({ params }: Props) {
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
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <AdminSubpageHeader
        title={tChrome('blackBoxTitle')}
        badge={tChrome('blackBoxBadge')}
        subtitle={tChrome('blackBoxSubtitle')}
        backLabel={tNav('backToAdmin')}
        icon={<Archive className="h-5 w-5" strokeWidth={1.75} />}
      />
      <BlackBoxArchiveClient />
    </div>
  );
}
