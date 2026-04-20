import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Email pour alertes Compliance / Guardian : priorité variables d’environnement,
 * sinon premier compte avec rôle admin dans profiles (email Supabase Auth).
 */
export async function getAdminComplianceNotifyEmail(
  admin: SupabaseClient
): Promise<string | null> {
  const env =
    process.env.ADMIN_COMPLIANCE_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.SENTINEL_ALERT_EMAIL?.trim();
  if (env) return env;

  const { data: rows, error } = await admin.from('profiles').select('id').eq('role', 'admin').limit(12);

  if (error || !rows?.length) {
    return null;
  }

  for (const row of rows) {
    const uid = row.id as string;
    try {
      const { data, error: uErr } = await admin.auth.admin.getUserById(uid);
      if (uErr || !data?.user?.email) continue;
      return data.user.email;
    } catch {
      continue;
    }
  }

  return null;
}
