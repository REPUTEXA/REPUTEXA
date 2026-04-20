import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Ancienne route : le flux caisse vit sous Avis WhatsApp → onglet Flux (URL ?tab=flux). */
export default async function TransactionFlowPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const q = new URLSearchParams();
  q.set('tab', 'flux');
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined || key === 'tab') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => q.append(key, v));
    } else {
      q.set(key, value);
    }
  }
  redirect(`/${locale}/dashboard/whatsapp-review?${q.toString()}`);
}
