/**
 * Après « 1 » / oui sur WhatsApp — message avec accroche ticket + micro-conseil « maison ».
 * Avec ou sans last_purchase (conseil sectoriel général si pas de ticket).
 */

import OpenAI from 'openai';
import {
  GROUNDED_FACTS_CHARTER_SNIPPET,
  HUMAN_KEYBOARD_CHARTER_SNIPPET,
  scrubAiTypography,
} from '@/lib/ai/human-keyboard-output';

export type PostConsentFeedbackParams = {
  establishmentName: string;
  establishmentType?: string | null;
  firstName?: string | null;
  lastPurchase?: string | null;
};

/** Même convention que le webhook (`Merci` / `Merci, Léa` …). */
export function merciOpeningLine(firstName?: string | null): string {
  const part = firstName?.trim() ? `, ${firstName.trim()}` : '';
  return `Merci${part} ! 🙏`;
}

const SYSTEM_WITH_TICKET = `Tu rédiges UN message WhatsApp envoyé par un commerce local (personne de l'équipe, pas un bot).

Contraintes :
- Vouvoiement obligatoire. Ton chaleureux, court, naturel, comme entre deux services.
- Le message doit commencer exactement par la ligne d'ouverture fournie (Merci…), puis un saut de ligne, puis le corps.
- Corps : 2 à 4 phrases. Accrocher au dernier achat (réutiliser ses termes). Puis au plus UN micro-conseil pratique, strictement déductible de ce qui figure dans « Dernier achat » (même famille de produit ou service, pas d'ingrédient, lieu, marque ou astuce qui n'y apparaît pas). Si tu ne peux pas sans inventer, reste sur l'écoute et une question ouverte.
- Inviter à dire comment ça s'est passé, honnêtement, en texte ou vocal, avec l'emoji 🎙️ une fois. Option : si un membre de l'équipe a particulièrement plu, ils peuvent le mentionner.
- Jamais demander d'avis Google ni d'étoiles. Pas de liste à puces. Pas les mots robot, IA, ChatGPT, automatique.

${HUMAN_KEYBOARD_CHARTER_SNIPPET}

${GROUNDED_FACTS_CHARTER_SNIPPET}`;

const SYSTEM_NO_TICKET = `Tu rédiges UN message WhatsApp envoyé par un commerce local (personne de l'équipe, pas un bot).

Contraintes :
- Vouvoiement obligatoire. Ton chaleureux, court, naturel.
- Le message commence EXACTEMENT par la ligne d'ouverture fournie (Merci…), puis saut de ligne, puis le corps.
- Pas de « dernier achat » précis : tu as seulement le type d'activité. Corps en 2 à 4 phrases : remercier l'accord, inviter à un retour honnête (ce qui a plu ou à ajuster), puis au plus UN micro-conseil très général pour le secteur, sans citer un produit, plat, marque ou service inventé (ex. salon : entretien des longueurs sans nommer une marque ; hôtel : sommeil / calme ; resto : rythme du service ; retail : entretenir la matière achetée de façon générale).
- Inviter texte ou vocal avec 🎙️ une fois.
- Jamais avis Google ni étoiles. Pas liste à puces. Pas robot, IA, ChatGPT, automatique.

${HUMAN_KEYBOARD_CHARTER_SNIPPET}

${GROUNDED_FACTS_CHARTER_SNIPPET}`;

function buildUserWithTicket(params: PostConsentFeedbackParams): string {
  const type = params.establishmentType?.trim() || 'non précisé';
  const lp = params.lastPurchase!.trim();
  const open = merciOpeningLine(params.firstName);
  return [
    `Commerce : ${params.establishmentName}`,
    `Type d'activité : ${type}`,
    `Dernier achat (texte exact, ne pas inventer au-delà) : ${lp}`,
    `Première ligne obligatoire : "${open}"`,
  ].join('\n');
}

function buildUserNoTicket(params: PostConsentFeedbackParams): string {
  const type = params.establishmentType?.trim() || 'non précisé';
  const open = merciOpeningLine(params.firstName);
  return [
    `Commerce : ${params.establishmentName}`,
    `Type d'activité (pour le ton du conseil général) : ${type}`,
    `Aucun détail d'achat fourni — ne citez aucun produit précis.`,
    `Première ligne obligatoire : "${open}"`,
  ].join('\n');
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

function normalizeOpening(text: string, firstName?: string | null): string {
  const expectedStart = merciOpeningLine(firstName);
  const cleaned = scrubAiTypography(text);
  if (!cleaned.startsWith(expectedStart)) {
    return scrubAiTypography(`${expectedStart}\n\n${cleaned.replace(/^\s+/, '')}`);
  }
  return cleaned;
}

export function staticPostConsentFallback(params: PostConsentFeedbackParams): string {
  const open = merciOpeningLine(params.firstName);
  const name = params.establishmentName.trim() || 'chez nous';
  const lp = params.lastPurchase?.trim();
  if (lp) {
    return (
      `${open}\n\n` +
      `Comment s'est passé votre *${lp}* ? Dites ce qui vous a plu ou ce qu'on peut ajuster, en texte ou en vocal 🎙️ ` +
      `Si quelqu'un de l'équipe vous a particulièrement marqué, vous pouvez le nommer.`
    );
  }
  return (
    `${open}\n\n` +
    `En quelques mots (ou en vocal), comment s'est passée votre expérience chez *${name}* ? ` +
    `Ce qui vous a plu ou ce qui coinçait, on prend tout 🎙️`
  );
}

/**
 * Message complet après accord client. Utilise l'API si configurée, sinon null (appeler staticPostConsentFallback).
 */
export async function generatePostConsentFeedbackMessage(
  params: PostConsentFeedbackParams
): Promise<string | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const hasTicket = !!params.lastPurchase?.trim();
  const system = hasTicket ? SYSTEM_WITH_TICKET : SYSTEM_NO_TICKET;
  const user = hasTicket ? buildUserWithTicket(params) : buildUserNoTicket(params);

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 320,
      temperature: hasTicket ? 0.75 : 0.65,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) return null;
    return normalizeOpening(text, params.firstName);
  } catch (e) {
    console.error('[post-consent-feedback-message]', e);
    return null;
  }
}
