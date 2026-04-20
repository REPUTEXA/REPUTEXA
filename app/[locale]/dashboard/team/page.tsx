import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

type Props = { params: Promise<{ locale: string }> };

/** Ancienne route : l’équipe se gère sous Avis WhatsApp → Paramètres. */
export default async function TeamDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(`/${locale}/dashboard/whatsapp-review?tab=parametres`);
}
