'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Déconnexion côté client + POST serveur pour effacer les cookies httpOnly
 * (session Supabase + Grand Central : grand_central_bind, anti-spam alerte).
 */
export async function clientSignOutWithServerSession(): Promise<void> {
  try {
    await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* réseau : on poursuit le nettoyage local */
  }
  const supabase = createClient();
  await supabase.auth.signOut({ scope: 'local' });
}
