/**
 * Premier WhatsApp de la file review_queue — même logique que la démo :
 * amélioration du service d’abord, oui/non (1 / 2), pas de lien Google à cette étape.
 */

export type ReviewQueueInitialMessageParams = {
  firstName: string;
  commerceName: string;
  /** metadata.last_purchase si présent */
  lastPurchase?: string | null;
};

export function buildReviewQueueInitialWhatsApp(params: ReviewQueueInitialMessageParams): string {
  const prenom = params.firstName?.trim() || 'vous';
  const nomCommerce = params.commerceName.trim() || 'nous';
  const lp = params.lastPurchase?.trim();

  const filAriane = lp
    ? `\n\nOn a noté votre passage avec *${lp}* — si ça ne correspond pas, dites-le nous en deux mots quand même, ça nous évite les quiproquos.`
    : '';

  return (
    `Bonjour ${prenom} 👋\n\n` +
    `Merci d'avoir choisi *${nomCommerce}* — on espère que tout s'est bien passé.${filAriane}\n\n` +
    `On cherche surtout à *mieux vous servir* : un retour honnête en deux minutes (ce qui vous a plu ou ce qu'on peut ajuster) nous aide vraiment. Pas un sondage, juste votre ressenti.\n\n` +
    `Répondez *1* pour nous en parler — vous pourrez écrire ou envoyer un vocal juste après.\n` +
    `Répondez *2* si vous préférez qu'on ne vous sollicite pas sur ce fil.\n\n` +
    `À tout moment vous pouvez aussi répondre *STOP*.`
  );
}
