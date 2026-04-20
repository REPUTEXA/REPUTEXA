/**
 * Finalisation sortie WhatsApp (Twilio / Meta) : typographie clavier, sans ajouter de contenu.
 * Ne modifie pas le sens ni n'invente pas de faits (conformité zéro invention).
 */
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';

/**
 * Normalise le texte avant envoi WhatsApp : glyphes LLM, sauts de ligne, espaces.
 */
export function finalizeWhatsappOutboundText(raw: string): string {
  let s = scrubAiTypography(raw);
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/\n{4,}/g, '\n\n\n');
  return s.trim();
}
