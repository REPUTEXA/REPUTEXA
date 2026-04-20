export type LocalePack = { subject: string; html: string };

export const BROADCAST_EMAIL_LOCALES = ['fr', 'en', 'es', 'de', 'it'] as const;
export type BroadcastEmailLocale = (typeof BROADCAST_EMAIL_LOCALES)[number];

/** Assure une entrée par locale ; les clés manquantes héritent du contenu FR. */
export function normalizeLocalePacks(
  input: Partial<Record<string, LocalePack>>
): Record<BroadcastEmailLocale, LocalePack> {
  const fr = input.fr ?? { subject: '', html: '' };
  const out = {} as Record<BroadcastEmailLocale, LocalePack>;
  for (const loc of BROADCAST_EMAIL_LOCALES) {
    const p = input[loc];
    if (p?.subject?.trim() && p?.html?.trim()) {
      out[loc] = { subject: p.subject.trim(), html: p.html.trim() };
    } else {
      out[loc] = { subject: fr.subject.trim(), html: fr.html.trim() };
    }
  }
  return out;
}

/** Snapshot canonique (avant SHA-256) — identique côté client et serveur. */
export function broadcastPacksUnlockSnapshot(packs: Partial<Record<string, LocalePack>>): string {
  const n = normalizeLocalePacks(packs);
  const keys = [...BROADCAST_EMAIL_LOCALES].sort();
  const stable = keys.map((k) => [k, n[k].subject, n[k].html] as const);
  return JSON.stringify(stable);
}

/** Empreinte du message **source FR** uniquement (traductions générées côté serveur à l’envoi global). */
export function broadcastFrMasterUnlockSnapshot(subjectFr: string, htmlFr: string): string {
  return JSON.stringify(['fr_master_v2', subjectFr.trim(), htmlFr.trim()]);
}
