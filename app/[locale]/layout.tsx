import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { BillingCycleProvider } from '@/lib/billing-cycle-context';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

const SEO_CONFIG: Record<
  string,
  {
    title: string;
    description: string;
  }
> = {
  fr: {
    title: 'Reputexa | Votre Directeur de la Relation Client 24/7',
    description:
      "Automatisez vos avis, protégez votre e-réputation et boostez votre chiffre d'affaires grâce à l'IA.",
  },
  en: {
    title: 'Reputexa | Your 24/7 Customer Relationship Director',
    description:
      "Automate reviews, protect your online reputation and grow your revenue with AI.",
  },
  es: {
    title: 'Reputexa | Su Director de Relación con el Cliente 24/7',
    description:
      'Automatice sus reseñas, proteja su reputación online y aumente su facturación gracias a la IA.',
  },
  de: {
    title: 'Reputexa | Ihr Director of Customer Relations 24/7',
    description:
      'Automatisieren Sie Bewertungen, schützen Sie Ihren Online-Ruf und steigern Sie Ihren Umsatz mit KI.',
  },
  it: {
    title: 'Reputexa | Il tuo Direttore della Relazione Clienti 24/7',
    description:
      'Automatizza le recensioni, protegge la tua reputazione online e aumenta il fatturato grazie all’IA.',
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const seo = SEO_CONFIG[locale] ?? SEO_CONFIG.fr;
  const baseUrl = 'https://reputexa.fr';
  const localePath = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? `/${locale}`
    : '/fr';

  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: `${baseUrl}${localePath}`,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `${baseUrl}${localePath}`,
      siteName: 'Reputexa',
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <BillingCycleProvider defaultCycle="month">
        {children}
      </BillingCycleProvider>
    </NextIntlClientProvider>
  );
}

