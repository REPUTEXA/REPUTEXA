/** Même clé que dans la page collecte d&apos;avis (brouillon profil d&apos;activité). */
export const ACTIVITY_PROFILE_DRAFT_STORAGE_KEY = 'reputexa_collecte_activity_profile_v1';

/** Catégorie en cours dans le navigateur (peut différer de la base avant Enregistrer). */
export function readActivityProfileDraftCategory(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ACTIVITY_PROFILE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as { userId?: string; categoryKey?: string };
    if (d.userId !== userId) {
      try {
        sessionStorage.removeItem(ACTIVITY_PROFILE_DRAFT_STORAGE_KEY);
      } catch {
        /* */
      }
      return null;
    }
    return typeof d.categoryKey === 'string' ? d.categoryKey : null;
  } catch {
    return null;
  }
}

export function writeActivityProfileDraft(userId: string, categoryKey: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      ACTIVITY_PROFILE_DRAFT_STORAGE_KEY,
      JSON.stringify({ userId, categoryKey })
    );
  } catch {
    /* */
  }
}

export function clearActivityProfileDraft() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ACTIVITY_PROFILE_DRAFT_STORAGE_KEY);
  } catch {
    /* */
  }
}
