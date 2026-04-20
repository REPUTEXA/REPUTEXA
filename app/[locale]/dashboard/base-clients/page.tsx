import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ member?: string }>;
};

/** Ancienne route : tout est regroupé sous /dashboard/whatsapp-review */
export default async function LegacyBaseClientsRedirect({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const p = new URLSearchParams();
  p.set('tab', 'clients');
  if (sp.member) p.set('member', sp.member);
  redirect(`/${locale}/dashboard/whatsapp-review?${p.toString()}`);
}
