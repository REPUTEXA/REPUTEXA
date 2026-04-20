import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/**
 * Alias /verify vers /confirm-email pour compatibilité.
 * La page de vérification principale reste confirm-email (OTP + UX).
 */
type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { email } = await searchParams;
  setRequestLocale(locale);

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return null;
  }

  const qs = email ? `?email=${encodeURIComponent(email)}` : '';
  redirect(`/${locale}/confirm-email${qs}`);
}
