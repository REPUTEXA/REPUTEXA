/**
 * Génération des 3 variantes de réponse pour la démo modale (landing).
 * Un seul moteur par session : Claude si disponible (meilleure nuance rédactionnelle),
 * sinon OpenAI. Variantes + arbitrage + version courte (parcours « retouche ») sur ce moteur.
 * Server-only.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { DemoDashboardExample, DemoReviewTone } from '@/lib/landing/demo-dashboard-data';
import { staticCandidates } from '@/lib/landing/demo-dashboard-static-replies';
import {
  GROUNDED_FACTS_CHARTER_SNIPPET,
  HUMAN_KEYBOARD_CHARTER_SNIPPET,
  scrubAiTypography,
} from '@/lib/ai/human-keyboard-output';

import { ANTHROPIC_DEFAULT_SONNET } from '@/lib/ai/anthropic-model-defaults';

const ANTHROPIC_MODEL = ANTHROPIC_DEFAULT_SONNET;
const OPENAI_MODEL = 'gpt-4o-mini';

type Engine = 'anthropic' | 'openai';

export type DemoReplyOption = {
  text: string;
  engine: Engine;
  styleKey: 'empathy' | 'direct' | 'followup';
};

export type DemoReplyGeneration = {
  options: DemoReplyOption[];
  selectedIndex: number;
  judgeEngine: Engine | null;
  enginesUsed: Engine[];
  /** Moteur utilisé pour tout le flux (rédaction + juge + raccourci) */
  primaryEngine: Engine | null;
  /** Proposition raccourcie après demande client (démo WhatsApp « retouche ») */
  revisedShorter: string | null;
};

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

/** Claude prioritaire pour la qualité de rédaction des réponses publiques. */
function pickPrimaryEngine(): Engine | null {
  if (getAnthropic()) return 'anthropic';
  if (getOpenAI()) return 'openai';
  return null;
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

function normalizeReply(text: string): string {
  return scrubAiTypography(text.replace(/\s+/g, ' ').trim());
}

function naiveShorten(text: string, locale: string): string {
  const t = text.trim();
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, 2).join(' ');
  }
  const max = locale === 'fr' ? 220 : 200;
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(' ', max);
  return (cut > 40 ? t.slice(0, cut) : t.slice(0, max)) + '...';
}

export function buildFallbackDemoGeneration(
  locale: string,
  ex: DemoDashboardExample
): DemoReplyGeneration {
  const staticOpts = staticCandidates(ex, locale);
  const selectedIndex =
    staticOpts[2]!.length > staticOpts[0]!.length + 20 ? 2 : 1;
  const chosen = staticOpts[selectedIndex]!;
  return {
    options: [
      { text: staticOpts[0]!, engine: 'openai', styleKey: 'empathy' },
      { text: staticOpts[1]!, engine: 'openai', styleKey: 'direct' },
      { text: staticOpts[2]!, engine: 'openai', styleKey: 'followup' },
    ],
    selectedIndex,
    judgeEngine: null,
    enginesUsed: [],
    primaryEngine: null,
    revisedShorter: naiveShorten(chosen, locale),
  };
}

function demoLocalSeoBlock(ex: DemoDashboardExample, fr: boolean): string {
  if (!ex.city?.trim() && !ex.seoContext?.trim()) return '';
  const bits = [
    ex.city?.trim() ? (fr ? `zone : ${ex.city.trim()}` : `area: ${ex.city.trim()}`) : '',
    ex.seoContext?.trim()
      ? fr
        ? `Mention naturelle : ${ex.seoContext.trim()}`
        : `Natural mention: ${ex.seoContext.trim()}`
      : '',
  ].filter(Boolean);
  return fr
    ? `\nRéférence locale & visibilité : ${bits.join(' · ')}, une seule intégration fluide, jamais une liste de mots-clés ni #.`
    : `\nLocal visibility: ${bits.join(' · ')}, one smooth phrase, never a keyword list or hashtags.`;
}

const ECHO_FR =
  "Reprends au moins une tournure ou un fait concret de l'avis (produit, timing, personnel) sans recopier les insultes ni jurons.";
const ECHO_EN =
  'Echo at least one concrete phrase or fact from the review (product, timing, staff), never quote slurs or profanity.';

const DEMO_GROUNDING_FR = `${GROUNDED_FACTS_CHARTER_SNIPPET}\n${HUMAN_KEYBOARD_CHARTER_SNIPPET}`;
const DEMO_GROUNDING_EN = `
TRUTHFULNESS (mandatory): never invent facts, numbers, legal claims, posters, products, brands, or staff not present in the review/context. If unknown, stay general or say you do not have the detail.
STYLE: no em/en dashes; no spaced hyphen between clauses; use commas or periods. Use three ASCII dots for ellipsis, never the single glyph.
`.trim();

function systemsForLocale(
  locale: string,
  ex: DemoDashboardExample
): { empathy: string; direct: string; followup: string } {
  const fr = locale === 'fr';
  const tone: DemoReviewTone = ex.reviewTone ?? 'negative';
  const ratingNote = `${ex.rating}/5`;
  const seoTail = demoLocalSeoBlock(ex, fr);

  if (tone === 'positive') {
    const ctx = fr
      ? `Établissement : "${ex.business}". Avis Google (${ratingNote}, positif) : « ${ex.review} ». Client : ${ex.reviewer}.${seoTail}`
      : `Business: "${ex.business}". Google review (${ratingNote}, positive): "${ex.review}". Customer: ${ex.reviewer}.${seoTail}`;

    if (fr) {
      return {
        empathy: `Tu es le gérant. ${ctx}
${ECHO_FR}
Rédige UNE réponse publique courte (2–3 phrases) : remerciement sincère et personnalisé (détail concret du message du client), ton chaleureux professionnel. Pas d'excuse pour un problème inexistant. Pas de liste à puces. Jamais IA / robot.
Texte seul.`,

        direct: `Réponse Google efficace. ${ctx}
${ECHO_FR}
2 phrases max : merci + invitation à revenir / recommander, avec un détail qui montre que tu as lu l'avis. Pas marketing. Texte seul.`,

        followup: `Variante plus « humaine caisse ». ${ctx}
${ECHO_FR}
2–3 phrases, un peu plus détendu mais toujours vouvoiement et pro. Remerciement + fierté de l'équipe. Texte seul.`,
      };
    }
    return {
      empathy: `You're the owner. ${ctx}
${ECHO_EN}
ONE short public reply (2–3 sentences): warm, specific thank-you (pick up a detail from their review). No apology for non-issues. No bullets. Never AI.
Plain text only.`,

      direct: `Efficient Google reply. ${ctx}
${ECHO_EN}
2 sentences max: thanks + invite them back / tell friends, with one concrete callback to their review. Not marketing. Plain text only.`,

      followup: `Slightly more casual-professional variant. ${ctx}
${ECHO_EN}
2–3 sentences, still polite. Thank the team pride angle. Plain text only.`,
    };
  }

  if (tone === 'hateful') {
    const platform = ex.platformLabel ?? (fr ? 'Google Business Profile / Avis' : 'Google Business Profile / Reviews');
    const ctx = fr
      ? `Établissement : "${ex.business}"${ex.city ? ` (${ex.city})` : ''}. Plateforme cible : ${platform}. Avis signalé comme toxique (${ratingNote}) : « ${ex.review} ». Identifiant affiché sur la fiche : ${ex.reviewer}.`
      : `Business: "${ex.business}"${ex.city ? ` (${ex.city})` : ''}. Target platform: ${platform}. Flagged toxic-type review (${ratingNote}): "${ex.review}". On-listing author name: ${ex.reviewer}.`;

    if (fr) {
      return {
        empathy: `Tu es le conseiller juridique / conformité REPUTEXA (ton courtois, factuel). ${ctx}
Rédige UNE demande de modération / retrait à destination de la plateforme (plain text, style e-mail ou formulaire long).
- Rappelle sans vulgarité que le contenu comporte des attaques personnelles ou un ton manifestement injurieux.
- Cite les grandes familles de motifs (contenu harcelant / diffamatoire / hors charte), sans inventer de numéro de loi précis.
- Ne recopie pas mot pour mot les insultes ; parle d'« attaques personnelles » ou « propos discriminatoires » si pertinent.
- Demande explicitement l'examen et le retrait si non-conformité avérée.
- Signe : « Direction · ${ex.business} ».
Zéro mention d'IA.`,

        direct: `Rédige une variante PLUS COURTE et percutive de la même demande. ${ctx}
3 à 5 phrases : identification fiche + motif principal + demande claire de modération + formule de politesse + signature ${ex.business}.
Jamais de citation des injures. Texte seul.`,

        followup: `Troisième angle : insiste sur l'impact concret sur une petite structure locale et sur le caractère manifestement abusif du ton, tout en restant dans un registre procédural sobre. ${ctx}
Lettre modérée, 120–220 mots. Pas d'insultes ni de menaces. Signature professionnelle.`,
      };
    }
    return {
      empathy: `You draft platform Trust & Safety style removal/moderation requests for REPUTEXA Shield. ${ctx}
Write ONE plain-text request suitable for Google Business / review appeal flows.
- Calm, factual: note personal attacks, abusive tone, or policy violations without quoting slurs verbatim.
- Reference policy buckets (harassment, deceptive content, off-topic attacks) without citing fake statute numbers.
- Ask for human review and removal if terms are breached.
- Sign as "Management · ${ex.business}".
Never mention AI.`,

      direct: `Shorter, punchy variant of the same moderation request. ${ctx}
3–5 sentences: listing ID context + primary violation + clear moderation ask + polite close + ${ex.business}.
Do not quote profanity. Plain text only.`,

      followup: `Third angle: emphasize harm to a local small business and clearly abusive tone, still formal procedural language. ${ctx}
Moderate letter, ~120–220 words. No insults or threats. Professional signature.`,
    };
  }

  const ctx = fr
    ? `Établissement : "${ex.business}". Avis Google (note faible ou mitigée, ${ratingNote}) : « ${ex.review} ». Client : ${ex.reviewer}.${seoTail}`
    : `Business: "${ex.business}". Google review (low or mixed rating, ${ratingNote}): "${ex.review}". Customer: ${ex.reviewer}.${seoTail}`;

  if (fr) {
    return {
      empathy: `Tu es un directeur d'établissement expert en e-réputation. ${ctx}
${ECHO_FR}
Rédige UNE réponse publique courte (2 à 4 phrases) à poster sur Google.
- Vouvoiement, empathie sincère, une excuse ou reconnaissance claire.
- Propose un geste concret ou une suite privilégiée (sans cliché vide).
- Zéro jargon corporate, zéro liste à puces, zéro "nous vous remercions de votre retour".
- Ne jamais mentionner IA, robot, automatisation.
Réponds par du texte seul, sans guillemets autour.`,

      direct: `Tu rédiges une réponse Google professionnelle et efficace. ${ctx}
${ECHO_FR}
2 à 3 phrases maximum : excuse pertinente, responsabilité assumée, UNE action / invitation claire (recontact, visite, remise en cause du problème).
Ton calme, humain, pas marketing. Interdit : "intelligence artificielle", listes, émojis.
Texte seul.`,

      followup: `Tu rédiges une variante DIFFÉRENTE des excuses classiques. ${ctx}
${ECHO_FR}
Insiste sur l'amélioration continue et l'écoute : ce que l'équipe retient de ce passage, sans minimiser.
Termine par une ouverture dialogue (sans répéter mot pour mot les autres variantes possibles).
2 à 4 phrases, vouvoiement, humain. Pas d'IA / robot. Texte seul.`,
    };
  }

  return {
    empathy: `You're an experienced owner replying on Google Reviews. ${ctx}
${ECHO_EN}
Write ONE public reply (2–4 short sentences).
- Empathetic, specific apology or accountability, one concrete next step or goodwill gesture.
- No bullet lists, no corporate filler, never say "thank you for your feedback" in a generic way.
- Never mention AI or automation.
Plain text only, no surrounding quotes.`,

    direct: `Professional Google review reply. ${ctx}
${ECHO_EN}
2–3 sentences max: relevant apology, clear ownership, ONE crisp call to action (reach out, revisit, make it right).
Calm human tone, not marketing. No emojis, no AI mention. Plain text only.`,

    followup: `Alternative reply angle : improvement & listening. ${ctx}
${ECHO_EN}
Acknowledge what the team learns from this visit without sounding defensive.
End with a genuine invitation to continue the conversation.
2–4 sentences, plain text, no AI mention.`,
  };
}

type DemoOutputKind = 'public_reply' | 'removal_request';

async function completeAnthropic(
  system: string,
  locale: string,
  kind: DemoOutputKind = 'public_reply'
): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic) throw new Error('no-anthropic');
  const outputRule =
    kind === 'removal_request'
      ? locale === 'fr'
        ? 'Tu réponds uniquement par le texte final de la demande (plain text), sans commentaire méta.'
        : 'Reply with only the final formal request text as plain paragraphs, no meta commentary.'
      : locale === 'fr'
        ? 'Tu réponds uniquement par le texte de la réponse finale, sans préambule ni titre.'
        : 'You reply with only the final reply text, no preamble or title.';
  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 500,
    temperature: 0.65,
    system: outputRule,
    messages: [{ role: 'user', content: system }],
  });
  const block = message.content.find((b) => b.type === 'text');
  return block && 'text' in block ? normalizeReply(block.text) : '';
}

async function completeOpenAI(system: string, kind: DemoOutputKind = 'public_reply'): Promise<string> {
  const openai = getOpenAI();
  if (!openai) throw new Error('no-openai');
  const systemContent =
    kind === 'removal_request'
      ? 'You output only formal plain-text paragraphs suitable for a platform moderation / removal request, no JSON, no fake letterhead boilerplate about being an AI.'
      : 'You output only the final business reply text as plain sentences, no labels, no quotes around the whole message.';
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.65,
    max_tokens: kind === 'removal_request' ? 650 : 450,
    messages: [
      {
        role: 'system',
        content: systemContent,
      },
      { role: 'user', content: system },
    ],
  });
  return normalizeReply(completion.choices[0]?.message?.content ?? '');
}

async function runEngine(
  engine: Engine,
  prompt: string,
  locale: string,
  kind: DemoOutputKind = 'public_reply'
): Promise<string> {
  if (engine === 'openai') return completeOpenAI(prompt, kind);
  return completeAnthropic(prompt, locale, kind);
}

async function pickBestIndex(
  locale: string,
  ex: DemoDashboardExample,
  texts: string[],
  engine: Engine,
  tone: DemoReviewTone
): Promise<{ index: number; judgeEngine: Engine | null }> {
  const fr = locale === 'fr';
  const joined = texts.map((txt, i) => `[${i}] ${txt}`).join('\n\n');
  const criteria =
    tone === 'positive'
      ? fr
        ? 'Critères : chaleur authentique, personnalisation (détail avis), clarté, envie de revenir, sans être sirupeux.'
        : 'Criteria: authentic warmth, personalization (callback to review), clarity, revisit appeal, not syrupy.'
      : tone === 'hateful'
        ? fr
          ? 'Critères (demande modération plateforme) : clarté des motifs, ton factuel et professionnel, pas de citations d’insultes, pertinence pour Trust & Safety, demande explicite d’examen.'
          : 'Criteria (platform moderation request): clear grounds, factual professional tone, no slur quotes, Trust & Safety relevance, explicit review/removal ask.'
        : fr
          ? 'Critères : empathie, clarté, responsabilité, action concrète, ton humain.'
          : 'Criteria: empathy, clarity, accountability, concrete next step, human tone.';

  const judgeSystem = fr
    ? tone === 'hateful'
      ? `Tu es un arbitre pour demandes de modération Google / avis. Choisis l'indice 0, 1 ou 2 le plus solide.
${criteria}
Réponds UNIQUEMENT en JSON : {"chosen":0|1|2}`
      : `Tu es un arbitre qualité pour réponses Google. Choisis l'indice 0, 1 ou 2 le plus adapté.
${criteria}
Réponds UNIQUEMENT en JSON : {"chosen":0|1|2}`
    : tone === 'hateful'
      ? `You arbitrate removal/moderation request drafts. Pick the strongest index 0, 1, or 2.
${criteria}
Reply ONLY JSON: {"chosen":0|1|2}`
      : `Pick the best Google reply index (0, 1, or 2).
${criteria}
Reply ONLY JSON: {"chosen":0|1|2}`;

  const judgeUser = fr
    ? `Établissement : ${ex.business}\nAvis : ${ex.review}\n\nVariantes :\n${joined}`
    : `Business: ${ex.business}\nReview: ${ex.review}\n\nVariants:\n${joined}`;

  try {
    if (engine === 'openai') {
      const openai = getOpenAI();
      if (!openai) throw new Error('skip');
      const res = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0,
        max_tokens: 60,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: judgeSystem },
          { role: 'user', content: judgeUser },
        ],
      });
      const raw = res.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as { chosen?: number };
      const c =
        typeof parsed.chosen === 'number' && parsed.chosen >= 0 && parsed.chosen < texts.length
          ? parsed.chosen
          : 0;
      return { index: c, judgeEngine: 'openai' };
    }

    const anthropic = getAnthropic();
    if (!anthropic) throw new Error('skip');
    const msg = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 80,
      temperature: 0,
      system: judgeSystem + '\nJSON only.',
      messages: [{ role: 'user', content: judgeUser }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    const txt = block && 'text' in block ? block.text : '{}';
    const parsed = extractJsonObject(txt) as { chosen?: number };
    const c =
      typeof parsed.chosen === 'number' && parsed.chosen >= 0 && parsed.chosen < texts.length
        ? parsed.chosen
        : 2;
    return { index: c, judgeEngine: 'anthropic' };
  } catch {
    let best = 0;
    let bestScore = -1;
    for (let i = 0; i < texts.length; i++) {
      const len = texts[i]!.length;
      const hasAction =
        tone === 'hateful'
          ? /Google|suppression|modération|contenu|conditions|signalement|harcèlement|abusif|plateforme|policy|removal|moderation|harassment|terms/i.test(
              texts[i]!
            )
          : /recontact|contact|téléphone|appelez|écrie|email|@|gratuit|ravie|ravis|accueillir|discut/i.test(
              texts[i]!
            );
      const score = len * 0.01 + (hasAction ? 15 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return { index: best, judgeEngine: null };
  }
}

async function shortenChosenReply(
  locale: string,
  engine: Engine,
  original: string,
  tone: DemoReviewTone
): Promise<string | null> {
  const fr = locale === 'fr';
  const prompt =
    tone === 'positive'
      ? fr
        ? `Le client demande une version PLUS COURTE sur WhatsApp avant de valider sur Google.
Réécris : remerciement chaleureux + une touche personnalisée, max 2 phrases courtes, vouvoiement. Pas d'excuse. Texte seul.

Texte actuel :
${original}`
        : `The customer wants a SHORTER WhatsApp version before posting on Google.
Rewrite: warm thanks + one personalized touch, max 2 short sentences, polite "you". No apology for non-issues. Sendable text only.

Current text:
${original}`
      : tone === 'hateful'
        ? fr
          ? `Le professionnel demande une version PLUS COURTE de la demande de modération / retrait à envoyer à la plateforme.
Garde le même niveau de professionnalisme ; 2 à 3 phrases denses maximum. Ne cite pas les insultes. Texte seul.

Texte actuel :
${original}`
          : `The merchant wants a SHORTER moderation/removal request for the platform.
Stay professional; 2–3 dense max sentences. Do not quote slurs. Plain text only.

Current text:
${original}`
        : fr
          ? `Le client demande une version PLUS COURTE pour un message WhatsApp (il validera pour poster sur Google après).
Réécris le texte ci-dessous : garde le vouvoiement, le ton adapté au contexte et UNE clarté d'action si pertinent, mais maximum 2 phrases courtes. Aucune introduction, seulement le texte prêt à envoyer.

Texte actuel :
${original}`
          : `The customer asked for a SHORTER WhatsApp-ready version before posting on Google.
Rewrite below: keep formal "you", appropriate tone, ONE clear thread if relevant, max 2 short sentences. No intro, only sendable text.

Current text:
${original}`;

  const grounding = fr ? DEMO_GROUNDING_FR : DEMO_GROUNDING_EN;
  const fullPrompt = `${prompt}\n\n${grounding}`;

  const outKind: DemoOutputKind = tone === 'hateful' ? 'removal_request' : 'public_reply';

  try {
    const text = await runEngine(engine, fullPrompt, locale, outKind);
    if (text.length < 20) return null;
    if (text.length >= original.length * 0.92) {
      return naiveShorten(original, locale);
    }
    return text;
  } catch {
    return naiveShorten(original, locale);
  }
}

export async function generateDemoDashboardReplies(
  locale: string,
  ex: DemoDashboardExample
): Promise<DemoReplyGeneration> {
  const primary = pickPrimaryEngine();
  const staticOpts = staticCandidates(ex, locale);

  if (!primary) {
    return buildFallbackDemoGeneration(locale, ex);
  }

  const sys = systemsForLocale(locale, ex);
  const grounding = locale === 'fr' ? DEMO_GROUNDING_FR : DEMO_GROUNDING_EN;
  const prompts: { styleKey: 'empathy' | 'direct' | 'followup'; text: string }[] = [
    { styleKey: 'empathy', text: `${sys.empathy}\n\n${grounding}` },
    { styleKey: 'direct', text: `${sys.direct}\n\n${grounding}` },
    { styleKey: 'followup', text: `${sys.followup}\n\n${grounding}` },
  ];

  const kind: DemoOutputKind = ex.reviewTone === 'hateful' ? 'removal_request' : 'public_reply';

  const results = await Promise.all(
    prompts.map(async (p, i) => {
      try {
        const text = await runEngine(primary, p.text, locale, kind);
        if (text.length < 24) throw new Error('short');
        return { text, engine: primary, styleKey: p.styleKey };
      } catch {
        return {
          text: staticOpts[i]!,
          engine: primary,
          styleKey: p.styleKey,
        };
      }
    })
  );

  const texts = results.map((r) => r.text);
  const tone = ex.reviewTone ?? 'negative';
  const { index: selectedIndex, judgeEngine } = await pickBestIndex(
    locale,
    ex,
    texts,
    primary,
    tone
  );

  const chosenText = results[selectedIndex]?.text ?? texts[0]!;
  let revisedShorter: string | null = await shortenChosenReply(
    locale,
    primary,
    chosenText,
    tone
  );
  if (!revisedShorter || revisedShorter.trim() === chosenText.trim()) {
    revisedShorter = naiveShorten(chosenText, locale);
  }

  return {
    options: results,
    selectedIndex,
    judgeEngine,
    enginesUsed: [primary],
    primaryEngine: primary,
    revisedShorter,
  };
}

