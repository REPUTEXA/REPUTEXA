import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PublicPageShell } from '@/components/public-page-shell';
import { JoinStaffForm } from './join-form';
import { WalletJoinClient } from './wallet-join-client';

type Props = { params: Promise<{ locale: string; token: string }> };

const MERCHANT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function JoinPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const admin = createAdminClient();
  if (!admin) notFound();

  const { data: inv, error: invErr } = await admin
    .from('merchant_team_invitations')
    .select('id, merchant_user_id, invitee_display_name, expires_at, consumed_at')
    .eq('token', token)
    .maybeSingle();

  const invRow = inv as
    | {
        consumed_at?: string | null;
        expires_at: string;
        merchant_user_id: string;
        invitee_display_name: string;
      }
    | null;

  const invValid =
    !invErr &&
    invRow &&
    !invRow.consumed_at &&
    new Date(String(invRow.expires_at)).getTime() >= Date.now();

  if (invValid) {
    const merchantId = String(invRow.merchant_user_id);
    const { data: merchant } = await admin
      .from('profiles')
      .select('establishment_name')
      .eq('id', merchantId)
      .maybeSingle();

    const establishmentName =
      merchant && typeof (merchant as { establishment_name?: string }).establishment_name === 'string'
        ? (merchant as { establishment_name: string }).establishment_name
        : '';

    const inviteeName = String(invRow.invitee_display_name);
    const t = await getTranslations({ locale, namespace: 'JoinStaff' });

    return (
      <PublicPageShell title={t('metaTitle')}>
        <JoinStaffForm
          token={token}
          locale={locale}
          establishmentName={establishmentName}
          inviteeName={inviteeName}
        />
      </PublicPageShell>
    );
  }

  if (!MERCHANT_UUID_RE.test(token)) {
    notFound();
  }

  const { data: merchantWallet } = await admin
    .from('profiles')
    .select('id, establishment_name')
    .eq('id', token)
    .maybeSingle();

  if (!merchantWallet?.id) {
    notFound();
  }

  const establishmentName =
    typeof (merchantWallet as { establishment_name?: string }).establishment_name === 'string'
      ? (merchantWallet as { establishment_name: string }).establishment_name
      : '';

  const t = await getTranslations({ locale, namespace: 'JoinWallet' });

  return (
    <PublicPageShell title={t('metaTitle')}>
      <div className="min-h-[100dvh] bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-zinc-100">
        <WalletJoinClient merchantId={token} establishmentName={establishmentName} locale={locale} />
      </div>
    </PublicPageShell>
  );
}
