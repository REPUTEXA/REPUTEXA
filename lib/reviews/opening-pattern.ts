import { OPENING_VARIANT_SLOT_COUNT } from '@/lib/ai/concierge-prompts';

/**
 * Chaînage des structures d'ouverture : évite deux schémas identiques d'affilée
 * (proxy via le texte publié précédent + hash du nouvel avis).
 */
export function nextOpeningPatternIndex(
  comment: string,
  reviewerName: string,
  lastPublishedReply: string | null | undefined
): number {
  const n = OPENING_VARIANT_SLOT_COUNT;
  let h = 0;
  const s = `${comment.trim()}\0${reviewerName.trim()}`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33 + s.charCodeAt(i)) >>> 0;
  }
  let v = h % n;

  const prev = (lastPublishedReply ?? '').trim();
  if (prev.length > 12) {
    let hp = 0;
    const slice = prev.slice(0, 100);
    for (let i = 0; i < slice.length; i++) {
      hp = (hp * 33 + slice.charCodeAt(i)) >>> 0;
    }
    const lastSlot = hp % n;
    if (v === lastSlot) {
      v = (v + 1) % n;
    }
  }

  return v;
}
