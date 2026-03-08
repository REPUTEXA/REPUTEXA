/**
 * Mappe les erreurs Supabase Auth vers des messages utilisateur clairs.
 * Remplace les codes techniques par des phrases élégantes affichées via Toast (Sonner).
 *
 * @param error - Objet d'erreur Supabase Auth (null-safe)
 * @returns Message lisible pour l'utilisateur
 */
export function getAuthErrorMessage(error: { message?: string; status?: number } | null): string {
  if (!error?.message) return 'Une erreur est survenue. Réessayez.';

  const msg = error.message.toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials'))
    return 'Email ou mot de passe incorrect.';
  if (msg.includes('email not confirmed')) return 'Vérifiez votre boîte mail pour confirmer votre compte.';
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'Un compte existe déjà avec cet email.';
  if (msg.includes('password') && msg.includes('weak')) return 'Mot de passe trop faible. Utilisez au moins 6 caractères.';
  if (msg.includes('signup_disabled')) return 'Les inscriptions sont temporairement désactivées.';
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (msg.includes('database') || msg.includes('db error') || msg.includes('saving new user') || msg.includes('trigger'))
    return 'Erreur technique lors de la création du profil. Vérifiez que toutes les migrations Supabase ont été appliquées.';
  if (msg.includes('duplicate key') || msg.includes('unique constraint'))
    return 'Un compte existe déjà avec cet email.';
  if (msg.includes('column') && (msg.includes('does not exist') || msg.includes('undefined')))
    return 'Configuration base de données obsolète. Exécutez : supabase db push';
  if (msg.includes('row-level security') || msg.includes('policy') || msg.includes('permission denied'))
    return 'Erreur de permissions. Contactez le support.';

  return 'Une erreur est survenue. Réessayez ou contactez le support.';
}
