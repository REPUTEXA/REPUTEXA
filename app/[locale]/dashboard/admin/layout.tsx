import { requireAdminOrRedirect } from '@/lib/admin/require-admin-server';

export const dynamic = 'force-dynamic';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Toute l’arborescence `/dashboard/admin/*` est réservée aux comptes `role === 'admin'`.
 * Les pages enfants peuvent garder leurs vérifications (defense in depth) ; cette barrière
 * évite d’oublier une route lors d’évolutions futures.
 */
export default async function AdminDashboardSectionLayout({ children, params }: Props) {
  const { locale } = await params;
  await requireAdminOrRedirect(locale);
  return <>{children}</>;
}
