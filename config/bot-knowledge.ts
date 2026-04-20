/**
 * Cerveau du chatbot d’accueil (landing) — prompts système + faits tarifaires.
 * Texte visible côté modèle : clés `Api.landingChat_*` dans `messages/{locale}.json`.
 */

import {
  PLAN_BASE_PRICES_EUR,
  PLAN_BASE_PRICES_GBP,
  PLAN_BASE_PRICES_JPY,
  PLAN_BASE_PRICES_USD,
} from '@/config/pricing';

/** Traduction `Api` (serveur), ex. `createServerTranslator('Api', locale)`. */
export type ApiLandingChatTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function buildLandingChatSystemPrompt(t: ApiLandingChatTranslate): string {
  return [
    t('landingChat_intro'),
    '',
    t('landingChat_keyboardCharter'),
    '',
    t('landingChat_groundedFactsCharter'),
    '',
    t('landingChat_roleAndProduct'),
  ].join('\n');
}

/** Bloc « données à jour » : montants depuis `config/pricing.ts`. */
export function buildLiveProductFacts(t: ApiLandingChatTranslate, locale?: string): string {
  const vE = PLAN_BASE_PRICES_EUR.vision;
  const pE = PLAN_BASE_PRICES_EUR.pulse;
  const zE = PLAN_BASE_PRICES_EUR.zenith;
  const vU = PLAN_BASE_PRICES_USD.vision;
  const pU = PLAN_BASE_PRICES_USD.pulse;
  const zU = PLAN_BASE_PRICES_USD.zenith;
  const vG = PLAN_BASE_PRICES_GBP.vision;
  const pG = PLAN_BASE_PRICES_GBP.pulse;
  const zG = PLAN_BASE_PRICES_GBP.zenith;
  const vJ = PLAN_BASE_PRICES_JPY.vision;
  const pJ = PLAN_BASE_PRICES_JPY.pulse;
  const zJ = PLAN_BASE_PRICES_JPY.zenith;
  const base = t('landingChat_liveFacts', {
    visionEur: vE,
    pulseEur: pE,
    zenithEur: zE,
    visionUsd: `$${vU}`,
    pulseUsd: `$${pU}`,
    zenithUsd: `$${zU}`,
    visionGbp: `£${vG}`,
    pulseGbp: `£${pG}`,
    zenithGbp: `£${zG}`,
  });
  if ((locale ?? '').toLowerCase() === 'ja') {
    return `${base}\n\n=== JPY (/ja) ===\n1拠点目・月額 JPY: Vision ¥${vJ}, Pulse ¥${pJ}, Zenith ¥${zJ}。`;
  }
  return base;
}

export function buildLandingChatFullSystemPrompt(
  t: ApiLandingChatTranslate,
  userMessageCount: number,
  locale: string,
): string {
  let prompt = [buildLandingChatSystemPrompt(t), '', buildLiveProductFacts(t, locale)].join('\n');
  const loc = locale.toLowerCase();
  if (loc === 'fr') {
    prompt += t('landingChat_languageFr');
  } else {
    prompt += t('landingChat_languageOther', { locale: loc });
  }
  if (userMessageCount >= 3) {
    prompt += '\n\n' + t('landingChat_leadCaptureInstruction');
  }
  return prompt;
}
