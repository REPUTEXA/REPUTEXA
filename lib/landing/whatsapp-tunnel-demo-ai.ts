/**
 * Génère une conversation WhatsApp fictive pour la démo landing (dual-engine si les deux clés sont présentes).
 * Server-only.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  TunnelDemoMessage,
  TunnelDemoPayload,
  TunnelGoogleScene,
  TunnelScenarioPath,
} from '@/types/whatsapp-tunnel-demo';

import { ANTHROPIC_DEFAULT_SONNET } from '@/lib/ai/anthropic-model-defaults';
import {
  GROUNDED_FACTS_CHARTER_SNIPPET,
  HUMAN_KEYBOARD_CHARTER_SNIPPET,
  scrubAiTypography,
} from '@/lib/ai/human-keyboard-output';
import { TUNNEL_STATIC_EXTRA } from '@/lib/landing/whatsapp-tunnel-static-extra';
import { TUNNEL_STATIC_ZH_JA_PT } from '@/lib/landing/whatsapp-tunnel-static-zh-ja-pt';

const ANTHROPIC_MODEL = ANTHROPIC_DEFAULT_SONNET;
const OPENAI_MODEL = 'gpt-4o-mini';

const SCENARIO_PATHS: TunnelScenarioPath[] = [
  'decline_first',
  'happy_full',
  'happy_with_edit',
  'stop_after_yes',
];

export type { TunnelDemoMessage, TunnelDemoPayload, TunnelScenarioPath } from '@/types/whatsapp-tunnel-demo';

export function parseTunnelScenarioKind(raw: string | null | undefined): TunnelScenarioPath | undefined {
  if (!raw || raw === 'random') return undefined;
  return SCENARIO_PATHS.includes(raw as TunnelScenarioPath) ? (raw as TunnelScenarioPath) : undefined;
}

/**
 * Locales démo tunnel : alignées sur la langue de la landing (pas de repli anglais par défaut).
 * FR/EN prompts natifs ; autres = prompt EN structuré + annexe registre ; zh/ja/pt inclus.
 */
export type TunnelDemoLocale = 'fr' | 'en' | 'it' | 'es' | 'de' | 'zh' | 'ja' | 'pt';

export function normalizeTunnelDemoLocale(locale: string): TunnelDemoLocale {
  const raw = locale.toLowerCase().trim();
  const s = raw.split(/[-_]/)[0] ?? raw;
  if (s === 'fr') return 'fr';
  if (s === 'it') return 'it';
  if (s === 'es') return 'es';
  if (s === 'de') return 'de';
  if (raw === 'zh-cn' || raw === 'zh-hans' || s === 'zh') return 'zh';
  if (s === 'ja') return 'ja';
  if (raw === 'pt-br' || s === 'pt') return 'pt';
  if (s === 'en' || raw === 'en-gb') return 'en';
  return 'en';
}

type NonFrEnTunnelLocale = Exclude<TunnelDemoLocale, 'fr' | 'en'>;

const LOCALE_LABEL: Record<TunnelDemoLocale, string> = {
  fr: 'French (France)',
  en: 'English',
  it: 'Italian',
  es: 'Spanish',
  de: 'German',
  zh: 'Simplified Chinese (China)',
  ja: 'Japanese (Japan)',
  pt: 'Portuguese (Portugal)',
};

function mandatoryLandingLanguageBlock(loc: TunnelDemoLocale): string {
  return `[LANDING PAGE LANGUAGE = ${LOCALE_LABEL[loc]}] Read this before any output. The entire demo (every bubble, establishmentName, googleScene strings) MUST be 100% in this language only. Do not default to English. Do not mix languages. No French unless the landing is French. Expert local operator tone, not translationese.\n\n`;
}

function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key?.trim()) return null;
  return new Anthropic({ apiKey: key });
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1]!.trim() : s;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Invalid JSON envelope');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

function scrubDemoMessages(messages: TunnelDemoMessage[]): TunnelDemoMessage[] {
  return messages.map((m) => ({ ...m, text: scrubAiTypography(m.text) }));
}

function parseGoogleScene(raw: unknown): TunnelGoogleScene | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const reviewSnippet = typeof o.reviewSnippet === 'string' ? o.reviewSnippet.trim() : '';
  const businessReply = typeof o.businessReply === 'string' ? o.businessReply.trim() : '';
  const replyDelayHint = typeof o.replyDelayHint === 'string' ? o.replyDelayHint.trim() : '';
  if (!reviewSnippet || !businessReply || !replyDelayHint) return null;
  return {
    reviewSnippet: scrubAiTypography(reviewSnippet),
    businessReply: scrubAiTypography(businessReply),
    replyDelayHint: scrubAiTypography(replyDelayHint),
  };
}

function scrubDemoPayload(p: TunnelDemoPayload): TunnelDemoPayload {
  const gs = p.googleScene != null ? parseGoogleScene(p.googleScene) : p.googleScene ?? null;
  return {
    ...p,
    messages: scrubDemoMessages(p.messages),
    googleScene: gs,
  };
}

function isTunnelDemoPayload(x: Record<string, unknown>): x is {
  establishmentName: string;
  messages: TunnelDemoMessage[];
  googleScene?: unknown;
} {
  const name = x.establishmentName;
  const messages = x.messages;
  if (typeof name !== 'string' || !name.trim()) return false;
  if (!Array.isArray(messages) || messages.length < 3) return false;
  for (const m of messages) {
    if (!m || typeof m !== 'object') return false;
    const rec = m as Record<string, unknown>;
    if (rec.from !== 'business' && rec.from !== 'client') return false;
    if (typeof rec.text !== 'string' || !rec.text.trim()) return false;
  }
  return true;
}

const LAST_VISIT_GAP_VALUES = ['same_day', 'few_weeks', 'few_months', 'long_absence'] as const;

type Brief = {
  venueType: string;
  venueName: string;
  clientFirstName: string;
  orderSummary: string;
  city: string;
  path: TunnelScenarioPath;
  /** Indice pour le transcript : mémoire « ça faisait un moment » sans inventer de date (démo / prod avec CRM). */
  lastVisitGap?: (typeof LAST_VISIT_GAP_VALUES)[number];
};

function isBrief(x: Record<string, unknown>): x is Brief {
  if (
    typeof x.venueType !== 'string' ||
    typeof x.venueName !== 'string' ||
    typeof x.clientFirstName !== 'string' ||
    typeof x.orderSummary !== 'string' ||
    typeof x.city !== 'string' ||
    !SCENARIO_PATHS.includes(x.path as TunnelScenarioPath)
  ) {
    return false;
  }
  if (x.lastVisitGap != null) {
    const g = x.lastVisitGap;
    if (typeof g !== 'string' || !LAST_VISIT_GAP_VALUES.includes(g as (typeof LAST_VISIT_GAP_VALUES)[number])) {
      return false;
    }
  }
  return true;
}

function briefSystemFR(forcedPath?: TunnelScenarioPath): string {
  const pathRule = forcedPath
    ? `path OBLIGATOIRE et EXACT : "${forcedPath}". Ne pas en choisir un autre.`
    : `path : tire au sort avec répartition indicative - decline_first ~22%, happy_full ~38%, happy_with_edit ~28%, stop_after_yes ~12%.`;

  return `Tu génères UN micro-scénario pour une démo produit (fictif).
Réponds UNIQUEMENT par un objet JSON valide, sans markdown, sans texte autour.
Clés obligatoires : venueType (string court), venueName (nom commerce inventé, crédible), clientFirstName (prénom seul), orderSummary (une ligne type ticket caisse : plat/soin/chambre précis), city (ville française), path (string).
Clé facultative : lastVisitGap — une seule valeur parmi "meme_jour" | "quelques_semaines" | "plusieurs_mois" | "longue_absence" pour permettre au transcript d’ancrer une phrase de mémoire (« cela faisait un moment… ») sans date inventée. Si la visite est le jour même, utilise "meme_jour" ou omets le champ.

Valeurs possibles pour path :
- "decline_first" : le client refusera tout de suite l'invitation des 2 minutes.
- "happy_full" : le client accepte, donne un avis, valide le texte proposé, jusqu'au message de fin (remerciement + rappel données / affiche caisse uniquement — pas de promesse de futur recontact).
- "happy_with_edit" : comme happy_full mais le client demande AU MOINS DEUX petites retouches successives au brouillon (ex. enlever une tournure, puis raccourcir encore) avant de valider — il a le dernier mot jusqu’à être satisfait.
- "stop_after_yes" : le client dit oui au début puis envoie STOP ou se rétracte au milieu - fin polie, plus de relance.

${pathRule}
Varie secteur, ton, ville : restaurant, salon, café, hôtel, boulangerie, coiffeur à domicile… À chaque appel, invente des détails neufs (pas toujours les mêmes plats).
orderSummary doit rester assez précis pour qu’un conseil de pro court et crédible puisse s’y rattacher (ex. plat + boisson, soin + durée, article + usage).`;
}

function briefSystemEN(forcedPath?: TunnelScenarioPath): string {
  const pathRule = forcedPath
    ? `path REQUIRED exactly: "${forcedPath}". Do not pick another.`
    : `path: random with approximate mix - decline_first ~22%, happy_full ~38%, happy_with_edit ~28%, stop_after_yes ~12%.`;

  return `You create ONE tiny fictional scenario for a product demo.
Reply with ONLY valid JSON, no markdown.
Keys: venueType (short), venueName (invented, believable), clientFirstName (first name only), orderSummary (one POS-style specific line), city, path (string).
Optional key: lastVisitGap — one of "same_day" | "few_weeks" | "few_months" | "long_absence" so the transcript can echo credible memory ("it's been a while…") without inventing exact dates. Omit or use "same_day" for same-day visits.

path must be one of:
- "decline_first" - client refuses the 2-minute feedback invite upfront.
- "happy_full" - client accepts, gives feedback, approves suggested paste-ready review, warm close + transparent data note only (never promise a future text or follow-up in X days).
- "happy_with_edit" - like happy_full but the client asks for at least TWO successive small edits to the draft before approving; they have the final say until satisfied.
- "stop_after_yes" - client says yes first then sends STOP or backs out mid-thread - polite close, no more outreach.

${pathRule}
Vary sector and details each time (restaurant, salon, café, hotel, bakery…). Never reuse the same dish name twice in a row across generations.
Keep orderSummary specific enough for a believable one-line staff tip (e.g. dish + drink, service + product).`;
}

const TRANSCRIPT_SYSTEM_FR = `Tu écris un transcript WhatsApp ultra-réaliste pour la démo REPUTEXA (site web).

STYLE - ULTRA HUMAIN, ULTRA PERSONNALISÉ :
- Côté commerce : vouvoiement strict ("vous", jamais "tu"). Préférer "Bonjour [prénom]" à "coucou/salut" côté professionnel.
- Phrases comme un patron qui texte entre deux services : rythme naturel, pas de liste à puces, pas de "nous vous remercions pour votre intérêt".
- Utiliser clientFirstName quand ça sonne naturel (pas à chaque message ; éviter la lourdeur).
- Ancrer au moins un détail concret par échange important dans orderSummary, venueName ou city (odeur, température, petit détail du plat, accueil…).
- Varier longueur des bulles : parfois une courte ("Top merci"), parfois 2 phrases.
- Côté client : style SMS réel (minuscules possibles, "ok", "nop", "laisse tomber", "jsuis chaud", etc.) selon le personnage - pas un client littéraire.
- CONSEILS « MAISON » : au total une ou deux phrases courtes sur tout le fil, uniquement si le conseil se déduit de orderSummary et venueType sans ajouter de fait nouveau (interdiction d’inventer origine, marque, AOC, fournisseur, criée, accord précis, nom d’équipier, horaire ou promesse absents du JSON scénario). Sinon rester sur l’écoute et les questions ouvertes. Ton collègue, pas cours ni pub. Ne pas empiler trois conseils d’affilée.

- Émojis (bulles commerce) : **0 à 3 sur tout le fil** ; parfois **1 à 2** dans une bulle qui sonne juste (ex. 🙏 après un merci, ✨ sur un compliment, 👍 discret), **jamais** trois émojis d’affilée ni combinaisons incohérentes.

INTERDIT dans les bulles : les mots "robot", "IA", "ChatGPT", "intelligence artificielle". Le commerce peut dire "notre équipe", "ici à [ville]".

CONSENTEMENT SANS NOMMER LE CANAL (obligatoire) :
- **Ne jamais** écrire dans une bulle commerce les formulations type « pour continuer sur WhatsApp », « sur WhatsApp », « cette conversation WhatsApp » — le client sait déjà où il est ; ça sonne modèle / IA.
- Préférer : « si vous voulez qu’on continue », « pour la suite par message », « vous préférez qu’on s’arrête là ou qu’on en parle deux minutes », « dites-moi oui ou non si ça vous va qu’on en discute ici ».
- Le **oui / non** pour poursuivre l’échange écrit reste **explicite** (RGPD), mais formulé comme un humain au poste.

VARIABILITÉ STRUCTURELLE (chaque génération = unique) :
- **Aucun gabarit** réutilisable : faire varier l’ordre des blocs (ticket / consentement / question ; ou question puis micro-consentement ; ou phrase chaleureuse puis demande en deux temps).
- **Jamais** deux transcripts avec la même structure de **première** bulle commerce ni le même rythme de phrases ; un lecteur ne doit pas pouvoir deviner un modèle.

OBJECTIF DU PARCOURS (très important) :
- Le premier message commerce doit montrer que l’enjeu est d’abord de s’améliorer et de mieux servir — recueillir un retour honnête — pas de demander un avis Google ou une note d’emblée.
- **Consentement RGPD (dès la première bulle commerce)** : oui ou non **explicite** pour poursuivre l’échange (voir règles ci-dessus sans nommer le canal), distinct de la demande de retour sur l’expérience (refus = clôture propre, pas de harcèlement).
- Inviter aussi à répondre par oui ou non (ou équivalent clair) pour accorder environ **deux minutes** sur le fond du retour.
- Proposer **une fois** une ouverture aux **suggestions** (« si vous avez une idée en plus… ») ; confirmer que la remontée ira au bon rôle selon venueType (cuisine, chef, équipe…) **sans prénom inventé**.
- Si la personne dit non ou STOP : message court, respectueux, préciser qu’elle ne sera plus sollicitée pour cette collecte / liste noire côté dispositif (sans jargon juridique lourd).

INTERDIT (conformité et ton) :
- Jamais demander ni suggérer un nombre d'étoiles ni une note maximale (pas de « 5 étoiles », pas d'emoji étoiles pour pousser la note). Sur Google, la personne choisit seule sa note.
- Jamais promettre une relance pour « redemander un avis » avant l’échéance : la plateforme impose 120 jours minimum entre deux campagnes de sollicitation pour le même numéro ; en dessous, aucun envoi n’est déclenché ; une fois ce délai écoulé, une nouvelle sollicitation peut être renvoyée (hors opposition). Ne pas dire non plus qu’on recontactera à une date précise. Si vous citez ~120 jours, inclure les deux volets : fin de la fenêtre anti-resollicitation (nouvel envoi possible après) et effacement/anonymisation des identifiants en file au plus tard à cette échéance (affiche en caisse), sans promettre un prochain échange personnel.
- Pour proposer le brouillon : formulation douce, sans pression (« si vous avez envie d'en laisser un petit mot en ligne », « quand vous aurez deux minutes », « zéro obligation »), éviter un ton sec du type « voici votre texte pour un avis Google ».
- Après validation : ne pas fusionner lien Google + mode d’emploi dans une seule bulle (voir ÉTAPE GOOGLE ci-dessous) — ne pas enchaîner avec des consignes sur les étoiles dans la bulle du lien.

FLUX SELON path du JSON scénario :
1) decline_first - commerce envoie le check-in (objectif amélioration + oui/non clair). Le client refuse ou STOP. Commerce : réponse courte, remerciement, précise qu'il n'y aura plus de sollicitation pour ce dispositif / numéro en liste noire pour ce flux (formulation humaine). Terminer là (3 à 5 bulles total).
2) happy_full - commerce check-in (amélioration du service, oui/non) ; client accepte ; commerce remercie et enchaîne avec UNE question ouverte liée à orderSummary, en intégrant si naturel UN micro-conseil « maison » dans la même bulle ou la suivante (voir règles expertise) ; client répond avec détails ; commerce peut éventuellement rebondir par une courte phrase d’accord + un second micro-conseil seulement si ça sonne utile et pas répétitif ; commerce propose un court texte prêt à coller optionnel (réemploi des mots du client, SEO léger), sans présenter ça comme l'objectif initial ; client valide ; **puis étape Google en 2-3 bulles commerce** (copie du brouillon / message précédent, puis lien seul, puis remerciement + données ~120 j, sans étoiles). 10 à 18 bulles.
3) happy_with_edit - comme happy_full jusqu'à la proposition de brouillon (y compris au moins un micro-conseil contextualisé orderSummary si le scénario le permet) ; le client demande une première retouche ; commerce ajuste ; le client demande AU MOINS une deuxième retouche (ou précise qu'il peut encore affiner par vocal/photo) ; commerce ajuste encore ; validation ; **même clôture Google en bulles séparées** (copie, lien seul, remerciement + données). Au moins deux allers-retours correctifs côté client. 12 à 18 bulles.
4) stop_after_yes - le client dit oui au début ; puis après une question du commerce ou après le brouillon, il envoie STOP / "en fait non" / "effacez mon num" ; commerce s'excuse de la gêne, confirme qu'il n'y aura plus de relance pour ce dispositif, formule de politesse. 6 à 10 bulles.

Premier message commerce : mentionner un délai approximatif depuis la visite ("tout à l'heure", "vers fin d'aprem", "ce soir"), jamais une heure pile trop technique.

MÉMOIRE & « MAJORDOME » (sans inventer de faits hors JSON scénario) :
- Si le JSON scénario contient **lastVisitGap** : l’utiliser pour une phrase naturelle — same_day = visite tout à l’heure / ce soir ; few_weeks = « ces dernières semaines » ; few_months / long_absence = « cela faisait un moment qu’on ne vous avait pas vu », **sans date précise inventée**. Si absent, rester sur le ticket du jour.
- Sinon : donner l’impression que le commerce se souvient du passage (écart temporel crédible — pas de date inventée).
- **Consentement** : dès le premier message commerce, **oui ou non** explicite pour poursuivre l’échange par message, **sans** écrire « sur WhatsApp » (refus = fin propre).
- **Suggestions** : si le client améliore quelque chose, confirmer que ce sera transmis à la bonne personne selon venueType (chef, boucher, esthéticienne…) — **sans prénom inventé**.
- Indiquer une fois qu’on peut répondre en **vocal** ou envoyer une **photo** du plat / résultat.
- **Variété** : alterner structures de phrases et longueurs de bulles ; éviter les tournures « IA » répétitives et les listes à puces dans les SMS.

ÉTAPE GOOGLE (après « oui » au brouillon) — **plusieurs bulles commerce**, jamais un pavé avec le lien au milieu :
- **Bulle 1** : confirmer que le texte à publier est celui du **message précédent** (la proposition entre guillemets) ; dire de le **copier par appui long** sur cette bulle, ou que côté REPUTEXA réel un lien dédié copie-colle automatiquement puis ouvre Google. **Aucune URL dans cette bulle.**
- **Bulle 2** : **uniquement** l’URL démo \`https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID\` (éventuellement une courte accroche d’une ligne du type « Fiche avis (démo) » puis le lien seul à la ligne suivante). Pas de liste d’instructions dans la même bulle que le lien.
- **Bulle 3** (recommandée) : remerciement + rappel fin de sollicitation / ~120 j **sans recoller l’URL**.

ALIGNEMENT « COMME EN PRODUCTION » (même barre que le tableau de bord) :
- Tout le fil doit respecter le cahier des charges réel : amélioration d’abord, consentement oui/non dès la première bulle commerce (**sans** nommer « WhatsApp » dans le texte), zéro sollicitation d’étoiles, brouillon qui réemploie les mots du client, lien Google **séparé** du bloc presse-papiers, clôture avec rappel données ~120 j sans promesse de recontact ni date de relance.

RÉPONSE PUBLIQUE GOOGLE (googleScene.businessReply) — même exigence que les réponses avis REPUTEXA :
- **Reprendre explicitement** au moins deux termes ou expressions concrètes tirés de **reviewSnippet** (produits, saveurs, détails d’expérience), comme un gérant qui cite vraiment l’avis. Interdit : remerciement générique interchangeable avec tout autre commerce.
- **Varier la structure** à chaque fois : pas deux \`businessReply\` avec la même ossature (merci + détail + à bientôt). Alterner entrées (détail cité d’abord, mini-question, constat court…).
- Tenir la même discipline que les réglages « ton / longueur / consignes » du tableau de bord : chaleur crédible, 2-3 phrases en général, pas de liste à puces ni slogan publicitaire. **0 ou 1 emoji** max si ça colle au ton (jamais une rangée).

Scène GOOGLE (landing) — pour path "happy_full" ou "happy_with_edit" uniquement : ajouter "googleScene" : {"reviewSnippet":"extrait court comme sur la fiche","businessReply":"réponse publique qui cite les mots de l’avis (voir règles ci-dessus)","replyDelayHint":"ex. ~18 h plus tard"}. Pour "decline_first" ou "stop_after_yes" : "googleScene": null.

${HUMAN_KEYBOARD_CHARTER_SNIPPET}

${GROUNDED_FACTS_CHARTER_SNIPPET}

Réponds UNIQUEMENT par JSON : {"establishmentName":"aligné sur venueName","messages":[{"from":"business"|"client","text":"..."}],"googleScene":null ou {...}}
Texte brut, pas de markdown ni guillemets typographiques parasites.`;

const TRANSCRIPT_SYSTEM_EN = `Write a hyper-realistic WhatsApp transcript for REPUTEXA (website demo).

STYLE - DEEPLY HUMAN AND PERSONALIZED :
- Business side: warm, professional English (formal "you"), like a manager texting between tasks - not marketing copy.
- Use clientFirstName only when it feels natural.
- Tie messages to concrete details from orderSummary, venueName, city (specific sensory or situational detail).
- Vary bubble length; casual business replies sometimes short.
- Customer: real SMS habits (lowercase ok, "nah", "sorry busy", etc.) - not literary.
- "Insider tips": at most one or two short lines in the whole thread, only if the tip is directly implied by orderSummary and venueType with zero extra invented facts (no made-up origin, brand, appellation, supplier, staff name, schedule, or promise not in the scenario JSON). Otherwise stay on listening and open questions. Colleague tone, not a lecture or ad stack.

- Emojis (business bubbles): **0-3 across the whole thread**; sometimes **1-2** in one bubble when it lands (e.g. 🙏 after thanks, ✨ on a compliment, 👍 light) — never a spammy stack or random mixes.

Never include the words "robot", "AI", "ChatGPT" in bubbles.

CONSENT WITHOUT NAMING THE APP (required):
- **Never** write stiff lines like "to continue on WhatsApp", "on WhatsApp", "this WhatsApp conversation" — the customer already knows the channel; it reads like a template / bot.
- Prefer: "happy to keep going here", "want us to stop here or chat two minutes", "reply yes or no if you're okay continuing", "if you'd rather we leave you alone, say so".

STRUCTURAL VARIETY (every generation must feel unique):
- **No reusable skeleton**: vary block order (receipt context → consent → question vs warm line → ask → micro-consent in a second bubble).
- **Never** two transcripts with the same **first** business-bubble shape or sentence rhythm; a reader should not detect a pattern.

JOURNEY GOAL (critical):
- First business message: improvement-first — you want honest feedback to serve better — never open with “please leave us a Google review” or star talk.
- **Consent (required in the first business bubble)**: explicit **yes or no** to keep the written thread going, **without** naming WhatsApp in the wording (see rules above), separate from agreeing to give feedback (no = clean stop).
- Ask for a clear yes or no (natural wording) for ~2 minutes of their time on the substance.
- Once, invite **suggestions**; confirm handoff to the right role for venueType (kitchen, chef, team…) — **no invented first names**.
- On no or STOP: short polite close; they won’t be contacted again for this programme / blocklisted for this capture (plain human wording).

HARD RULES (compliance & tone):
- Never ask for or hint at a star rating (no "give us 5 stars", no star emojis to nudge the rating). They choose alone on Google.
- Never promise a dated follow-up to ask for a review again before the window elapses: the stack enforces a 120-day minimum between solicitation campaigns for the same number; below that, nothing is sent; after that, a new solicitation may go out (unless opposed). Do not promise contact on a fixed date either. If you mention ~120 days, cover both: end of the anti re-solicit window (new outreach may resume after) and identifier erasure/anonymisation in the queue within that timeline (counter poster), without promising a personal future chat.
- When offering the draft: soft framing ("if you'd like to post a few words online", "whenever you have a minute", "no pressure"), avoid blunt "here is your Google review".
- **Google step (split bubbles, never one wall of text with the URL)**: After they approve the draft: **Business bubble 1** — confirm the text to post is the **previous message** (the quoted draft); they **long-press that bubble to copy**, or in live REPUTEXA a smart link copies then opens Google. **No URL in bubble 1.** **Business bubble 2** — **only** the demo URL \`https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID\` (optional one-line label, then the link alone). **Business bubble 3** (recommended): thanks + ~120-day data note, **no URL repeated**.
- After approval: do not pair star-count instructions with the link bubble.

FLOWS by scenario path:
1) decline_first - improvement-first check-in + clear yes/no; customer declines or STOP; business thanks them and confirms they won’t be messaged again for this flow (blocklist for this programme, human wording). 3-5 bubbles total.
2) happy_full - same shape: improvement-first opener → they say yes → feedback question tied to order, weaving in ONE natural micro-tip when it fits (see insider tips) → they answer → optional brief agreement + at most a second tip only if useful, not repetitive → soft paste-ready draft (not framed as the original goal) → approve → **then Google step in 2-3 business bubbles** (copy prior draft bubble, standalone link bubble, thanks + ~120-day note, no stars). 10-18 bubbles.
3) happy_with_edit - same until draft (include at least one contextual micro-tip tied to orderSummary where natural); customer requests a first tweak, business revises; customer requests at least one more tweak (or adds nuance); business revises again; then approve + **same split-bubble Google close** as happy_full. Minimum two client-driven revision rounds. 12-18 bubbles.
4) stop_after_yes - yes first, then STOP / backs out mid-thread; business apologizes for noise, confirms no further outreach for this program. 6-10 bubbles.

First business message: approximate timing since visit, not robotic timestamps.

MEMORY & "DIGITAL CONCIERGE" (no invented facts beyond the scenario JSON):
- Feel remembered (credible time gap phrasing — never invent exact dates).
- **Consent**: first business message must include an explicit **yes or no** to continue the chat, **without** saying "on WhatsApp" (refusal = clean close).
- **Suggestions**: if the customer improves something, confirm it will reach the right role for venueType (chef, butcher, stylist…) — **no invented first names**.
- Mention once they may reply by **voice note** or send a **photo**.
- Google step: **split business bubbles** (see HARD RULES): draft copy instruction first, **standalone link bubble second**, thanks + data note third. Never one paragraph that embeds the URL with full instructions.

PRODUCTION-GRADE ALIGNMENT (same bar as live deployments):
- The whole thread must follow the real playbook: improvement-first opener, explicit yes/no in the first business bubble (**no** stiff "on WhatsApp" phrasing), no star begging, paste-ready draft in the customer’s own vocabulary, **Google link in its own bubble**, close with ~120-day data handling and no dated follow-up promise.

PUBLIC GOOGLE REPLY (googleScene.businessReply) — same quality bar as dashboard review replies:
- **Must explicitly reuse** at least two concrete words or phrases from **reviewSnippet** (dishes, drinks, feelings, specifics). Write like a real owner answering that exact text — not a generic “thanks for your kind words”.
- **Vary structure every time**: never two replies with the same skeleton (thanks + detail + see you). Alternate openings (lead with a quoted detail, a short observation, a natural question…).
- Match the spirit of merchant settings (tone, length, human voice): warm but believable, usually 2-3 sentences, no bullet-point marketing voice. **0 or 1 emoji** max if it fits — never a row.

GOOGLE scene (landing) — for path "happy_full" or "happy_with_edit" only: add "googleScene": {"reviewSnippet":"short excerpt as on the listing","businessReply":"public reply that quotes the review (see rules above)","replyDelayHint":"e.g. ~18h later"}. For "decline_first" or "stop_after_yes": "googleScene": null.

${HUMAN_KEYBOARD_CHARTER_SNIPPET}

${GROUNDED_FACTS_CHARTER_SNIPPET}

Reply ONLY JSON: {"establishmentName":"string","messages":[{"from":"business"|"client","text":"..."}],"googleScene":null or {...}}
Plain text only, no markdown.`;

/** Annexes brief : noms de villes / ticket caisse crédibles par pays + rappel langue. */
const BRIEF_LOCALE_APPENDIX: Record<NonFrEnTunnelLocale, string> = {
  it: `LOCALIZATION: Every string value in the JSON must be Italian.
city: plausible Italian city; venueName: believable Italian trade name; orderSummary: one line like an Italian POS receipt (dish/service + detail); clientFirstName: common first name in Italy.
Optional lastVisitGap: same_day | few_weeks | few_months | long_absence for narrative memory without inventing dates.`,
  es: `LOCALIZATION: Every string value in the JSON must be Spanish (Spain or neutral Latin American as appropriate for the city you pick).
city: plausible Spanish-speaking city; venueName: believable; orderSummary: one line like a local POS ticket; clientFirstName: typical for that region.
Optional lastVisitGap: same_day | few_weeks | few_months | long_absence for narrative memory without inventing dates.`,
  de: `LOCALIZATION: Every string value in the JSON must be German.
city: plausible DACH city; venueName: believable German trade name; orderSummary: one line like a German POS receipt; clientFirstName: typical first name.
Optional lastVisitGap: same_day | few_weeks | few_months | long_absence for narrative memory without inventing dates.`,
  zh: `LOCALIZATION: Every string value in the JSON must be Simplified Chinese (mainland China).
city: plausible Chinese city; venueName: believable shop name in Chinese; orderSummary: one line like a local POS ticket; clientFirstName: typical Chinese given name (characters).
Optional lastVisitGap: same_day | few_weeks | few_months | long_absence for narrative memory without inventing dates.`,
  ja: `LOCALIZATION: Every string value in the JSON must be Japanese.
city: plausible Japanese city; venueName: believable trade name; orderSummary: one line like a Japanese POS receipt; clientFirstName: typical Japanese first name.
Optional lastVisitGap: same_day | few_weeks | few_months | long_absence for narrative memory without inventing dates.`,
  pt: `LOCALIZATION: Every string value in the JSON must be Portuguese (Portugal; polite professional register).
city: plausible Portuguese city; venueName: believable; orderSummary: one line like a local POS ticket; clientFirstName: typical in Portugal.
Optional lastVisitGap: same_day | few_weeks | few_months | long_absence for narrative memory without inventing dates.`,
};

/** Annexes transcript : registre, politesse refus/opt-out, pas de mélange de langues. */
const TRANSCRIPT_LOCALE_APPENDIX: Record<NonFrEnTunnelLocale, string> = {
  it: `OUTPUT LANGUAGE: Italian only in every bubble (including establishmentName and googleScene strings).

REGISTER — Italy:
- Business (from "business"): professional hospitality SMS — use formal "Lei" consistently; openings "Buonasera/Buongiorno [name]"; warm, human, never cold corporate; polite closings ("Grazie mille", "Buona serata"). Do not use informal "tu" for staff→client unless the brand is explicitly ultra-casual (default: formal).
- Client (from "client"): natural Italian SMS (lowercase ok, "ok", "sì", "fermati", "basta così", short fragments).
- Opt-out / refusal: gracious, clear, no guilt-tripping; confirm no further contact for this campaign ("non ricontatteremo", "fuori da questa raccolta", "nessun altro messaggio per questo flusso").
- Apply the same compliance rules as the English block (no star begging, 120-day data note, demo URL only) in idiomatic Italian. Do not mix Italian with English or French.
- CONSENT: first business bubble must include explicit yes/no to continue the chat, **never** the word "WhatsApp" in the wording (sounds robotic). Google step: **split bubbles** — copy instruction without URL, then link-only bubble \`https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID\`, then thanks + data note.
- GOOGLE preview: businessReply must quote at least two concrete terms from reviewSnippet (owner-style reply, not a generic thank-you).`,
  es: `OUTPUT LANGUAGE: Spanish only in every bubble.

REGISTER — Spanish:
- Business: professional but warm SMS ("Hola [name]"), clear usted/verb forms for service contexts (use respectful "usted" where natural for your variant); not marketing boilerplate.
- Client: natural SMS habits (lowercase ok, "vale", "mejor no", "para").
- Opt-out: courteous, confirm no further messages for this flow ("no te volveremos a escribir por esto").
- Same compliance as English, idiomatic Spanish only. No Spanglish.
- CONSENT: first business bubble must include explicit yes/no to continue the chat, **never** the word "WhatsApp" in the wording (sounds robotic). Google step: **split bubbles** — copy instruction without URL, then link-only bubble \`https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID\`, then thanks + data note.
- GOOGLE preview: businessReply must quote at least two concrete terms from reviewSnippet (owner-style reply, not a generic thank-you).`,
  de: `OUTPUT LANGUAGE: German only in every bubble.

REGISTER — German:
- Business: polite Sie-Form for service SMS; "Hallo [Name]" or time-of-day greeting; warm, concise; closings ("Vielen Dank", "Schönen Abend").
- Client: natural chat ("ok", "lieber nicht", "stop", lowercase ok).
- Opt-out: clear, friendly, confirm no further outreach for this programme; no guilt.
- Same compliance as English, idiomatic German only. No Denglish unless a proper noun requires it.
- CONSENT: first business bubble must include explicit yes/no to continue the chat, **never** the word "WhatsApp" in the wording (sounds robotic). Google step: **split bubbles** — copy instruction without URL, then link-only bubble \`https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID\`, then thanks + data note.
- GOOGLE preview: businessReply must quote at least two concrete terms from reviewSnippet (owner-style reply, not a generic thank-you).`,
  zh: `OUTPUT LANGUAGE: Simplified Chinese only in every bubble (including establishmentName and googleScene).

REGISTER — China:
- Business: professional service SMS; use polite 您 where appropriate; warm, concise; no Chinglish.
- Client: natural mainland chat ("行", "算了", "不用", short fragments).
- Opt-out: clear, respectful; confirm no further contact for this campaign.
- Same compliance as English (no star begging, 120-day data note, demo URL) in idiomatic Chinese. Do not mix with English except the fixed demo URL string.
- CONSENT: first business bubble must include explicit yes/no to continue the chat, **never** the word "WhatsApp" in the wording (sounds robotic). Google step: **split bubbles** — copy instruction without URL, then link-only bubble \`https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID\`, then thanks + data note.
- GOOGLE preview: businessReply must quote at least two concrete terms from reviewSnippet (owner-style reply, not a generic thank-you).`,
  ja: `OUTPUT LANGUAGE: Japanese only in every bubble.

REGISTER — Japan:
- Business: polite です/ます for service SMS; warm, concise; no broken English.
- Client: natural SMS/LINE habits (short, ok, やめとく).
- Opt-out: clear, polite; confirm no further outreach for this programme.
- Same compliance as English in idiomatic Japanese. Demo URL may stay as-is.
- CONSENT: first business bubble must include explicit yes/no to continue the chat, **never** the word "WhatsApp" in the wording (sounds robotic). Google step: **split bubbles** — copy instruction without URL, then link-only bubble \`https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID\`, then thanks + data note.
- GOOGLE preview: businessReply must quote at least two concrete terms from reviewSnippet (owner-style reply, not a generic thank-you).`,
  pt: `OUTPUT LANGUAGE: European Portuguese only in every bubble.

REGISTER — Portugal:
- Business: polite professional SMS; clear pt-PT; not Brazilian slang unless scenario demands.
- Client: natural Portuguese chat habits.
- Opt-out: courteous; confirm no further messages for this flow.
- Same compliance as English; no mixed languages.
- CONSENT: first business bubble must include explicit yes/no to continue the chat, **never** the word "WhatsApp" in the wording (sounds robotic). Google step: **split bubbles** — copy instruction without URL, then link-only bubble \`https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID\`, then thanks + data note.
- GOOGLE preview: businessReply must quote at least two concrete terms from reviewSnippet (owner-style reply, not a generic thank-you).`,
};

function briefSystemForLocale(loc: TunnelDemoLocale, forcedPath?: TunnelScenarioPath): string {
  const block = mandatoryLandingLanguageBlock(loc);
  if (loc === 'fr') return `${block}${briefSystemFR(forcedPath)}`;
  const base = briefSystemEN(forcedPath);
  if (loc === 'en') return `${block}${base}`;
  return `${block}${base}\n\n${BRIEF_LOCALE_APPENDIX[loc]}`;
}

function transcriptSystemForLocale(loc: TunnelDemoLocale): string {
  const block = mandatoryLandingLanguageBlock(loc);
  if (loc === 'fr') return `${block}${TRANSCRIPT_SYSTEM_FR}`;
  if (loc === 'en') return `${block}${TRANSCRIPT_SYSTEM_EN}`;
  return `${block}${TRANSCRIPT_SYSTEM_EN}\n\n${TRANSCRIPT_LOCALE_APPENDIX[loc]}`;
}

function demoBriefUserPrompt(loc: TunnelDemoLocale): string {
  const seed = `seed=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (loc === 'fr') return `Nouveau scénario. ${seed}`;
  if (loc === 'zh') return `新场景。${seed}`;
  if (loc === 'ja') return `新しいシナリオ。${seed}`;
  if (loc === 'pt') return `Novo cenário. ${seed}`;
  return `New scenario. ${seed}`;
}

function demoTranscriptUserPrompt(loc: TunnelDemoLocale, brief: Brief): string {
  const json = JSON.stringify(brief);
  if (loc === 'fr') return `Scénario JSON :\n${json}`;
  if (loc === 'zh') return `场景 JSON：\n${json}`;
  if (loc === 'ja') return `シナリオ JSON：\n${json}`;
  if (loc === 'pt') return `Cenário JSON:\n${json}`;
  return `Scenario JSON:\n${json}`;
}

async function generateBrief(
  engine: 'openai' | 'anthropic',
  locale: string,
  forcedPath?: TunnelScenarioPath
): Promise<Brief> {
  const loc = normalizeTunnelDemoLocale(locale);
  const system = briefSystemForLocale(loc, forcedPath);
  const user = demoBriefUserPrompt(loc);

  if (engine === 'openai') {
    const openai = getOpenAI();
    if (!openai) throw new Error('OpenAI not configured');
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (forcedPath) parsed.path = forcedPath;
    if (!isBrief(parsed)) throw new Error('Invalid brief shape');
    return parsed as Brief;
  }

  const anthropic = getAnthropic();
  if (!anthropic) throw new Error('Anthropic not configured');
  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 450,
    temperature: 1,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = message.content.find((b) => b.type === 'text');
  const text = block && 'text' in block ? block.text : '';
  const parsed = extractJsonObject(text);
  if (forcedPath) parsed.path = forcedPath;
  if (!isBrief(parsed)) throw new Error('Invalid brief shape');
  return parsed as Brief;
}

async function generateTranscript(
  engine: 'openai' | 'anthropic',
  locale: string,
  brief: Brief
): Promise<Pick<TunnelDemoPayload, 'establishmentName' | 'messages' | 'googleScene'>> {
  const loc = normalizeTunnelDemoLocale(locale);
  const system = transcriptSystemForLocale(loc);
  const user = demoTranscriptUserPrompt(loc, brief);

  const finalize = (parsed: Record<string, unknown>) => {
    if (!isTunnelDemoPayload(parsed)) throw new Error('Invalid transcript');
    let googleScene = parseGoogleScene(parsed.googleScene);
    if (brief.path === 'decline_first' || brief.path === 'stop_after_yes') {
      googleScene = null;
    }
    return {
      establishmentName: String(parsed.establishmentName ?? '').trim(),
      messages: scrubDemoMessages(parsed.messages as TunnelDemoMessage[]),
      googleScene,
    };
  };

  if (engine === 'openai') {
    const openai = getOpenAI();
    if (!openai) throw new Error('OpenAI not configured');
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.9,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return finalize(parsed);
  }

  const anthropic = getAnthropic();
  if (!anthropic) throw new Error('Anthropic not configured');
  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2500,
    temperature: 0.9,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = message.content.find((b) => b.type === 'text');
  const text = block && 'text' in block ? block.text : '';
  const parsed = extractJsonObject(text);
  return finalize(parsed);
}

async function singleEngineFull(
  locale: string,
  engine: 'openai' | 'anthropic',
  forcedPath?: TunnelScenarioPath
): Promise<TunnelDemoPayload> {
  const brief = await generateBrief(engine, locale, forcedPath);
  const scenario = brief.path;
  const { establishmentName, messages, googleScene } = await generateTranscript(engine, locale, brief);
  return { establishmentName, messages, enginesUsed: [engine], scenario, googleScene };
}

function staticByScenario(locale: string, scenario: TunnelScenarioPath): TunnelDemoPayload {
  const engines: ('openai' | 'anthropic')[] = [];

  if (locale === 'it' || locale === 'es' || locale === 'de') {
    return TUNNEL_STATIC_EXTRA[locale][scenario];
  }

  if (locale === 'zh' || locale === 'ja' || locale === 'pt') {
    return TUNNEL_STATIC_ZH_JA_PT[locale][scenario];
  }

  if (locale === 'fr') {
    const S: Record<TunnelScenarioPath, TunnelDemoPayload> = {
      decline_first: {
        establishmentName: 'Aux Deux Cyprès',
        enginesUsed: engines,
        scenario: 'decline_first',
        messages: [
          {
            from: 'business',
            text: 'Bonjour Camille, c’est Florent aux Deux Cyprès. On veut affiner nos assiettes sur Lyon avec un retour honnête sur votre tartare aux herbes de tout à l’heure.\n\nSi ça vous va qu’on en discute ici : dites oui, ou non si vous préférez qu’on s’arrête là — dans les deux cas c’est respecté 🙏 Si oui, vous auriez deux minutes pour nous dire ce qui vous a plu ou pas ?',
          },
          { from: 'client', text: 'non merci j’ai pas le temps pour les questionnaires' },
          {
            from: 'business',
            text: 'Compris Camille, merci quand même. Vous êtes mise sur liste noire pour cette collecte : on ne vous réécrira plus pour ce dispositif. Belle soirée.',
          },
          { from: 'client', text: '👍' },
        ],
      },
      happy_full: {
        establishmentName: 'Brasserie du Marché',
        enginesUsed: engines,
        scenario: 'happy_full',
        messages: [
          {
            from: 'business',
            text: 'Bonjour Thomas, ici la Brasserie du Marché — vous êtes reparti vers 21h15 avec la côte de bœuf pour deux + Saint-Émilion grand cru (bouteille qu’on a débouchée en salle). On veut mieux régler feu et service avec un retour sincère.\n\nVous préférez qu’on en parle deux minutes ici, ou qu’on s’arrête là ? Répondez oui ou non, promis zéro pression. Si oui : qu’est-ce qui a accroché ou pas côté cuisson et vin ?',
          },
          { from: 'client', text: 'oui vas-y' },
          {
            from: 'business',
            text: 'Merci. Petit truc qu’on glisse souvent : ouvrir le rouge une petite heure avant et laisser la viande se reposer 4–5 minutes hors feu, ça aide le jus à se redistribuer. Là, sans langue de bois : la cuisson vous allait, et le binôme viande/vin vous a parlé juste ?',
          },
          {
            from: 'client',
            text: 'franchement ouais rosé à cœur pile poil et le vin qui respirait bien après le service au carré le collègue nous a mis l’eau à la bouche sans nous prendre de haut',
          },
          {
            from: 'business',
            text: 'Ça nous fait plaisir. Si jamais vous avez envie d’en laisser un petit mot en ligne, voilà une proposition qui garde vos mots — uniquement si ça vous chante, zéro obligation :\n\n« Soirée à la Brasserie du Marché : côte rosée comme il faut, Saint-Émilion qui s’ouvre bien, conseils au carré sans blabla. On revient. »\n\nÇa vous irait tel quel ou on ajuste un détail ?',
          },
          { from: 'client', text: 'validé, j’adore' },
          {
            from: 'business',
            text: 'Parfait. Le texte à publier est celui du message juste au-dessus : appui long dessus pour le copier, puis ouvrez le message suivant.',
          },
          {
            from: 'business',
            text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
          },
          {
            from: 'business',
            text: 'Ça ouvre la fenêtre « Rédiger un avis » Google pour notre fiche : vous collez, vous choisissez votre note, vous publiez. Merci pour le retour. Comme en caisse : plus de relance sur ce fil pour ce dispositif dans la fenêtre des 120 jours.',
          },
        ],
        googleScene: {
          reviewSnippet:
            'Soirée à la Brasserie du Marché : côte rosée comme il faut, Saint-Émilion qui s’ouvre bien, conseils au carré sans blabla.',
          businessReply:
            'Merci pour ce mot précis — la côte rosée, le Saint-Émilion qui s’ouvre bien et le service au carré sans blabla : c’est exactement la ligne qu’on veut tenir. À très bientôt à la Brasserie du Marché.',
          replyDelayHint: 'Le lendemain vers 11 h',
        },
      },
      happy_with_edit: {
        establishmentName: 'Le Zinc du Marché',
        enginesUsed: engines,
        scenario: 'happy_with_edit',
        messages: [
          {
            from: 'business',
            text: 'Bonjour Étienne, j’espère que vous allez bien ✨ C’était vers fin d’après-midi que vous avez dégusté votre tartare de bœuf et votre verre de Bordeaux ici au Zinc du Marché, si je me tiens bien le ticket. On veut affiner le service avec un retour honnête, pas vous envoyer une usine à gaz.\n\nDeux minutes max si vous êtes partant : vous nous dites oui si on continue, non si vous préférez qu’on s’arrête là — promis, zéro pression.',
          },
          { from: 'client', text: 'oui vas-y' },
          {
            from: 'business',
            text: 'Merci. Partant de votre plat : vous avez trouvé le tartare à votre goût ? Il est souvent plébiscité pour la fraîcheur. Et si vous avez une suggestion en plus, elle remonte direct en cuisine — pas dans un tiroir.',
          },
          { from: 'client', text: 'ouais c’était bon, pas mal du tout' },
          {
            from: 'business',
            text: 'Top 🙏 — pour le Bordeaux, petit rappel maison : une demi-heure d’air avant, ça ouvre souvent les arômes (rien d’obligatoire, juste si vous retentez chez vous). Là, sans détour : la viande vous allait, et l’assaisonnement vous aurait pris un cran de plus ?',
          },
          {
            from: 'client',
            text: 'oui la viande nickel mais j’aurais aimé un peu plus d’assaisonnement',
          },
          {
            from: 'business',
            text: 'Je prends note — on peut pousser un peu les épices au dressage, je transmets au chef pour la prochaine fois. Pour finaliser, si vous voulez laisser un petit mot en ligne, voici une proposition :\n\n« J’ai apprécié le tartare de bœuf au Zinc du Marché, très bonne qualité, mais un peu plus d’assaisonnement aurait été parfait. »\n\nQu’en pensez-vous ? Vous pouvez aussi répondre en vocal ou envoyer une photo si c’est plus simple.',
          },
          {
            from: 'client',
            text: 'c’est pas mal mais j’aimerais enlever "très bonne qualité"',
          },
          {
            from: 'business',
            text: 'Pas de souci. Voici la version ajustée :\n\n« J’ai apprécié le tartare de bœuf au Zinc du Marché ; un peu plus d’assaisonnement aurait été parfait. »\n\nÇa vous va ?',
          },
          { from: 'client', text: 'ouais ça me va' },
          {
            from: 'business',
            text: 'Super. Le texte final est dans le message précédent : appui long pour le copier. Ensuite, ouvrez le lien suivant (démo) pour aller sur la fiche Google.',
          },
          {
            from: 'business',
            text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
          },
          {
            from: 'business',
            text: 'Vous collez, vous choisissez votre note, vous publiez. Merci pour votre retour, il est précieux pour nous. Vous ne recevrez plus de sollicitations pour ce dispositif dans la fenêtre des 120 jours (comme rappelé en caisse).',
          },
          { from: 'client', text: 'ok mercii 👍' },
        ],
        googleScene: {
          reviewSnippet:
            'J’ai apprécié le tartare de bœuf au Zinc du Marché ; un peu plus d’assaisonnement aurait été parfait.',
          businessReply:
            'Merci pour ce retour sur le tartare de bœuf — on pousse l’assaisonnement au dressage avec le chef pour coller à ce que vous décrivez. À bientôt au Zinc du Marché.',
          replyDelayHint: 'Le lendemain vers 15 h',
        },
      },
      stop_after_yes: {
        establishmentName: 'Maison Lumière Spa',
        enginesUsed: engines,
        scenario: 'stop_after_yes',
        messages: [
          {
            from: 'business',
            text: 'Bonjour M. Hadji, équipe Maison Lumière — le soin visage « éclat rosé » tout à l’heure vous a laissé comment ? On affine nos protocoles avec les retours clients.\n\nÇa vous va qu’on en parle encore un peu par message, ou vous préférez qu’on s’arrête là ? Oui / non, comme vous voulez. Si oui : deux minutes pour nous en dire un peu plus ?',
          },
          { from: 'client', text: 'oui ok' },
          {
            from: 'business',
            text: 'Merci. La sensation après le masque, la température de la pièce, l’odeur… un détail qui vous a marqué ?',
          },
          {
            from: 'client',
            text: 'stop en fait j’ai plus envie de recevoir ce genre de msg désolé',
          },
          {
            from: 'business',
            text: 'Entièrement compris. On clôt ici, vous êtes sur liste noire pour cette collecte — plus de message de notre côté sur ce dispositif. Merci quand même pour votre passage au spa, bonne fin de journée.',
          },
        ],
      },
    };
    return S[scenario];
  }

  const S: Record<TunnelScenarioPath, TunnelDemoPayload> = {
    decline_first: {
      establishmentName: 'Harbor Bench',
      enginesUsed: engines,
      scenario: 'decline_first',
      messages: [
        {
          from: 'business',
          text: "Hey Jordan — Harbor Bench. We’re trying to get sharper on the line: the crab roll + saison at lunch, what landed or didn’t for you.\n\nCool if we keep this thread going for feedback? Yes or no — if no, we’ll leave you alone. If yes, got ~90 seconds when you can?",
        },
        { from: 'client', text: 'appreciate it but no more texts pls' },
        {
          from: 'business',
          text: "Totally fair — thanks for answering. We’ll block this number for this feedback flow and won’t reach out again for it. Hope we see you another time.",
        },
      ],
    },
    happy_full: {
      establishmentName: 'Coal & Vine House',
      enginesUsed: engines,
      scenario: 'happy_full',
      messages: [
        {
          from: 'business',
          text: "Hi Alex, Coal & Vine — ribeye for two + a Sonoma Cab you took home around 8. We’re chasing better fire and wine service, not fishing for stars 🙏\n\nWant to keep going here for two honest minutes on what landed or felt off? Yes or no — totally fine either way.",
        },
        { from: 'client', text: 'yeah sure' },
        {
          from: 'business',
          text: 'Appreciate it. Quick house tip: give the steak 4–5 minutes off the heat before slicing, and if you open the Cab an hour ahead it usually sings a bit more — tiny things regulars like. Honestly though: cook hit how you wanted, and did the pairing pitch feel helpful or heavy?',
        },
        {
          from: 'client',
          text: 'medium rare dead on juicy somm read the table didnt lecture us pairing felt easy',
        },
        {
          from: 'business',
          text: 'Love that. If you ever want to post a few words online, here’s a light draft in your voice — only if it feels right, no pressure:\n\n"Night at Coal & Vine — ribeye spot-on medium rare, Cab that opened up nicely, somm read the table without a speech."\n\nWant any tweak?',
        },
        { from: 'client', text: 'nah ship it' },
        {
          from: 'business',
          text: "Locked in. Your draft is the message above — long-press it to copy. Next message is the link only.",
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: "That opens the Google write-review screen: paste, pick your stars, publish. Thanks for your time. Per our counter notice: we won’t message you again for this flow, and related data is kept only until auto-deletion around 120 days.",
        },
      ],
      googleScene: {
        reviewSnippet:
          'Night at Coal & Vine — ribeye spot-on medium rare, Cab that opened nicely, somm read the table without a speech.',
        businessReply:
          'Thank you — that ribeye, the Cab opening up, and a somm who read the table without a speech: that’s the experience we want on every table. See you again at Coal & Vine.',
        replyDelayHint: 'Next morning (~10h)',
      },
    },
    happy_with_edit: {
      establishmentName: 'Northside Fade',
      enginesUsed: engines,
      scenario: 'happy_with_edit',
      messages: [
        {
          from: 'business',
          text: "Chris — Maya at Northside Fade. Low taper + lineup from earlier; we’re mostly trying to improve our finishes. Got a minute to say what felt right or off? Yes or no, whatever’s easiest.",
        },
        { from: 'client', text: 'yup' },
        {
          from: 'business',
          text: 'Sharp through the neckline? Any irritation after the foil finish? Tiny tip: cool rinse on the neck the first night keeps the line crisp without drying you out.',
        },
        {
          from: 'client',
          text: 'clean taper no bumps, steam towel maybe a bit heavy on the scent',
        },
        {
          from: 'business',
          text: 'If you ever want a few words online, here’s a light draft in your voice — optional:\n\n"Northside Fade - razor-sharp low taper, neckline tidy, chill crew who keep the towel subtle."\n\nWant edits?',
        },
        { from: 'client', text: 'drop "razor-sharp" lol sounds try-hard' },
        {
          from: 'business',
          text: 'Fair. Revise:\n\n"Northside Fade - clean low taper, neat neckline, easygoing shop."\n\nBetter?',
        },
        { from: 'client', text: 'drop easygoing too generic' },
        {
          from: 'business',
          text: 'Got it.\n\n"Northside Fade - clean low taper, neat neckline, laid-back staff."\n\nYou can keep tweaking by text or voice if needed.',
        },
        { from: 'client', text: 'perfect' },
        {
          from: 'business',
          text: "Locked in. Copy the draft from the message above (long-press), then tap the next bubble.",
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: "Paste, stars, publish. Thanks for pushing it sharper. Per our counter note: no more texts for this flow, data ages out around 120 days.",
        },
      ],
      googleScene: {
        reviewSnippet: 'Northside Fade - clean low taper, neat neckline, laid-back staff.',
        businessReply:
          'Thanks for naming the low taper and neckline — we’ll keep that line clean for your next visit. Glad the crew felt laid-back, not salesy.',
        replyDelayHint: '~6h later',
      },
    },
    stop_after_yes: {
      establishmentName: 'Velvet Room Spa',
      enginesUsed: engines,
      scenario: 'stop_after_yes',
      messages: [
        {
          from: 'business',
          text: 'Evening Sam — Velvet Room Spa. Hot-stone shoulders after your flight: we’re tuning pressure and pace from real feedback.\n\nOkay to chat a bit more here? Yes or no — if yes, two minutes max when you’re ready.',
        },
        { from: 'client', text: 'yeah ok' },
        {
          from: 'business',
          text: 'Thank you. Was the pressure deep enough through the traps, or too much?',
        },
        { from: 'client', text: 'actually stop - not comfortable continuing over text' },
        {
          from: 'business',
          text: 'Understood — sorry for the noise. You’re blocklisted for this programme; we won’t message you again for it. Still glad you came in.',
        },
      ],
    },
  };
  return S[scenario];
}

function staticFallback(locale: string, forcedPath?: TunnelScenarioPath): TunnelDemoPayload {
  const loc = normalizeTunnelDemoLocale(locale);
  const path =
    forcedPath ??
    SCENARIO_PATHS[Math.floor(Math.random() * SCENARIO_PATHS.length)]!;
  return scrubDemoPayload(staticByScenario(loc, path));
}

/** Exposé pour l’API : démo statique (même contenu que fallback IA). */
export function getTunnelDemoStaticPayload(
  locale: string,
  forcedPath?: TunnelScenarioPath
): TunnelDemoPayload {
  return staticFallback(locale, forcedPath);
}

/**
 * Génère la démo. Si les deux clés sont présentes : brief sur un moteur, transcript sur l'autre (ordre aléatoire).
 */
export async function generateWhatsAppTunnelDemo(
  locale: string,
  forcedPath?: TunnelScenarioPath
): Promise<TunnelDemoPayload> {
  const loc = normalizeTunnelDemoLocale(locale);
  // IT/ES/DE/ZH/JA/PT : même pipeline IA que EN avec annexes registre ; fallback statique (TUNNEL_STATIC_EXTRA / TUNNEL_STATIC_ZH_JA_PT) si pas de clés / erreur / timeout.

  const hasA = !!getAnthropic();
  const hasO = !!getOpenAI();

  try {
    if (hasA && hasO) {
      const useOpenAiForBrief = Math.random() < 0.5;
      const briefEngine: 'openai' | 'anthropic' = useOpenAiForBrief ? 'openai' : 'anthropic';
      const transcriptEngine: 'openai' | 'anthropic' = useOpenAiForBrief ? 'anthropic' : 'openai';
      const brief = await generateBrief(briefEngine, loc, forcedPath);
      const scenario = brief.path;
      const { establishmentName, messages, googleScene } = await generateTranscript(
        transcriptEngine,
        loc,
        brief
      );
      return {
        establishmentName,
        messages,
        enginesUsed: [briefEngine, transcriptEngine],
        scenario,
        googleScene,
      };
    }
    if (hasA) {
      return singleEngineFull(loc, 'anthropic', forcedPath);
    }
    if (hasO) {
      return singleEngineFull(loc, 'openai', forcedPath);
    }
  } catch (e) {
    console.error('[whatsapp-tunnel-demo-ai]', e);
  }

  return staticFallback(loc, forcedPath);
}
