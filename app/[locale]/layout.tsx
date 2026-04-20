import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { resolveLocaleParam } from '@/lib/i18n/canonicalize-locale-path';
import { routing } from '@/i18n/routing';
import LocaleChrome from '@/components/locale-chrome';
import { assertLocalePublishedOrNotFound } from '@/lib/growth/locale-market-gate';
import { getBrandName } from '@/src/lib/empire-settings';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const resolved = resolveLocaleParam((await params).locale);
  if (!resolved) {
    notFound();
  }
  const locale = resolved;
  const t = await getTranslations({ locale, namespace: 'LocaleRootLayout' });
  const title = t('defaultTitle');
  const description = t('defaultDescription');
  const brand = getBrandName();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: brand,
      type: 'website',
      images: [{ url: '/logo-hd.png', width: 512, height: 512, alt: brand }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/logo-hd.png'],
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const resolved = resolveLocaleParam((await params).locale);
  if (!resolved) {
    notFound();
  }
  const locale = resolved;

  await assertLocalePublishedOrNotFound(locale);

  setRequestLocale(locale);
  /**
   * Dictionnaire complet pour toute l’arborescence `[locale]/*` :
   * `i18n/request.ts` charge `messages/{locale}.json` et fusionne avec `fr` si besoin.
   * Sans cet objet, les Client Components (`useTranslations`) ne résolvent pas les clés.
   */
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleChrome>{children}</LocaleChrome>
    </NextIntlClientProvider>
  );
}

