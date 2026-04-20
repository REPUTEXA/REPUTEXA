import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { StaffShell } from '@/components/staff/staff-shell';
import { StaffRevokedBanner } from '@/components/staff/staff-revoked-banner';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login?next=/${locale}/staff`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role !== 'merchant_staff') {
    redirect(`/${locale}/dashboard`);
  }

  const { data: membership } = await supabase
    .from('merchant_team_members')
    .select('id, status, merchant_user_id')
    .eq('member_user_id', user.id)
    .maybeSingle();

  if (!membership) {
    redirect(`/${locale}/dashboard`);
  }

  if ((membership as { status: string }).status !== 'active') {
    const t = await getTranslations({ locale, namespace: 'Staff.revoked' });
    return <StaffRevokedBanner message={t('body')} signOutLabel={t('signOut')} />;
  }

  return <StaffShell>{children}</StaffShell>;
}
