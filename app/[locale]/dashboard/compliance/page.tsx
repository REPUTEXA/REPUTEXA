import { redirect } from 'next/navigation';

type Props = { params: Promise<{ locale: string }> };

/** Ancienne entrée « Centre de conformité » : regroupement sous Paramètres. */
export default async function ComplianceRedirectPage({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/settings`);
}
