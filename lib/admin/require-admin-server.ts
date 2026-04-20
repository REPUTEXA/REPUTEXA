import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Garde serveur : accès réservé aux profils `profiles.role === 'admin'`.
 * Sinon : login si non connecté, dashboard marchand si rôle insuffisant.
 */
export async function requireAdminOrRedirect(locale: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }
}
