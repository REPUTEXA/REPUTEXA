import { isChallengePeriodActive } from '@/lib/reputexa-challenge/score-reviews';
import { canAccessReputexaChallenge } from '@/lib/reputexa-challenge/subscription-access';

export type ChallengeForWhatsApp = {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  competition_message: string;
};

/** Texte doux si le patron n’a pas rédigé de message personnalisé. */
export const DEFAULT_CHALLENGE_WHATSAPP_FR =
  '🏆 En ce moment, petit jeu bienveillant entre nous : on aimerait mettre en avant celles et ceux qui font la différence au quotidien. Si quelqu’un vous a particulièrement plu, vous pouvez mentionner son prénom ou ce qui vous a marqué — c’est entièrement libre, et ça nous aide à progresser. Merci !';

/**
 * Bloc à ajouter aux messages WhatsApp tant que la période défi est active.
 * Priorité au texte saisi par le commerçant ; sinon texte par défaut non agressif.
 */
export function isChallengeMessagingActive(ch: ChallengeForWhatsApp | null | undefined): boolean {
  if (!ch) return false;
  return isChallengePeriodActive(ch.is_active, ch.starts_at, ch.ends_at);
}

export function getChallengeWhatsAppAppendix(ch: ChallengeForWhatsApp | null | undefined): string | null {
  if (!ch) return null;
  if (!isChallengePeriodActive(ch.is_active, ch.starts_at, ch.ends_at)) return null;
  const custom = ch.competition_message?.trim();
  if (custom) return custom;
  return DEFAULT_CHALLENGE_WHATSAPP_FR;
}

/** Annexes défi dans les fils WhatsApp : comptes Zénith uniquement. */
export function getChallengeWhatsAppAppendixForMerchant(
  ch: ChallengeForWhatsApp | null | undefined,
  merchantSubscriptionPlan: string | null | undefined
): string | null {
  if (!canAccessReputexaChallenge(merchantSubscriptionPlan)) return null;
  return getChallengeWhatsAppAppendix(ch);
}

export function appendChallengeToWhatsAppBody(body: string, appendix: string | null): string {
  if (!appendix) return body;
  return `${body.trimEnd()}\n\n${appendix.trim()}`;
}
