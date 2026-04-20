import OpenAI from 'openai';
import { HUMAN_KEYBOARD_CHARTER_SNIPPET_EN } from '@/lib/ai/human-keyboard-output';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';
import { normalizeAutomationDashes } from '@/lib/banano/banano-automation-defaults';
import { REPUTEXA_CROSS_CUT_AI_VOICE_EN } from '@/lib/ai/reputexa-cross-cut-voice';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

/** Seuil d’absence pour envoyer un « bon retour » après une visite caisse (override possible). */
export function welcomeBackMinDays(): number {
  const raw = process.env.BANANO_WELCOME_BACK_MIN_DAYS;
  const n = raw != null && raw !== '' ? parseInt(raw, 10) : 21;
  return Number.isFinite(n) ? Math.min(365, Math.max(7, n)) : 21;
}

export function welcomeBackWhatsAppEnabled(): boolean {
  return process.env.BANANO_WELCOME_BACK_WHATSAPP !== '0';
}

/**
 * Libellé qualitatif de durée d’absence (pour prompt OpenAI + JSON utilisateur).
 * Aligné sur `profiles.language`.
 */
export function absenceBucketLabel(days: number, locale?: string | null): string {
  const loc = normalizeAppLocale(locale ?? undefined);
  const t = createServerTranslator('Dashboard.bananoLoyaltyAi', loc);
  if (days >= 120) return t('absence_d120');
  if (days >= 60) return t('absence_d60');
  if (days >= 35) return t('absence_d35');
  if (days >= 21) return t('absence_d21');
  if (days >= 14) return t('absence_d14');
  return t('absence_d0');
}

const PERSONALIZE_SYSTEM_EN = `
You rewrite short WhatsApp paragraphs for a neighbourhood shop's loyalty automation.
Output: ONE paragraph only (1-2 sentences max), warm and genuine, never cheesy.
Scenario rules (from the user JSON):
- lost_client: gentle "we would love to see you again", no guilt, do not mention exact day counts.
- birthday: simple joy, no jargon.
- vip_of_month: sincere recognition tied to the period and revenue if provided.
Stay faithful to the meaning of current_text; you may enrich slightly, do not double the length.
No emoji. Do not invent offers (discounts are handled elsewhere).
Reply with plain text only, no surrounding quotes.
`.trim();

const WELCOME_BACK_SYSTEM_EN = `
You write ONLY the middle part (1-2 sentences max) of a WhatsApp message.
Context: the customer just visited the shop again after an absence (see JSON). They already had several visits in the past.
Tone: quiet joy at seeing them back, light rapport, zero guilt, zero invented promotion.
Do not quote exact day counts; you may say "a while" or "some time" in the target language.
Output: only this middle paragraph, no greeting line and no sign-off.
`.trim();

/**
 * Réécrit le paragraphe « personnalisé » du milieu (relances automatiques fidélité)
 * pour un ton mémoire / complicité — sortie dans la langue du profil marchand.
 */
export async function personalizeLoyaltyAutomationMiddle(args: {
  scenario: 'lost_client' | 'birthday' | 'vip_of_month';
  commerceName: string;
  prenom: string;
  baseMiddle: string;
  lostDaysInactive?: number;
  vipPeriodLabel?: string;
  vipMontantCa?: string;
  /** `profiles.language` (normalisé). */
  locale: string;
  /** Pour lost_client : libellé qualitatif (voir absenceBucketLabel). */
  absenceBucketLabel?: string;
}): Promise<string> {
  const base = args.baseMiddle.trim();
  const openai = getOpenAI();
  if (!openai || !base) return base;

  const loc = normalizeAppLocale(args.locale);
  const tAi = createServerTranslator('Dashboard.bananoLoyaltyAi', loc);

  const payload = {
    scenario: args.scenario,
    commerce: args.commerceName.trim() || 'Shop',
    first_name: (args.prenom || 'friend').trim(),
    current_text: base,
    absence:
      args.scenario === 'lost_client' && args.lostDaysInactive != null
        ? {
            days: args.lostDaysInactive,
            bucket_hint: (args.absenceBucketLabel ?? absenceBucketLabel(args.lostDaysInactive, loc)).trim(),
          }
        : undefined,
    vip:
      args.scenario === 'vip_of_month'
        ? {
            period: args.vipPeriodLabel ?? '',
            revenue_formatted: args.vipMontantCa ?? '',
          }
        : undefined,
  };

  try {
    const system = [
      PERSONALIZE_SYSTEM_EN,
      tAi('ai_output_language_instruction'),
      REPUTEXA_CROSS_CUT_AI_VOICE_EN,
      HUMAN_KEYBOARD_CHARTER_SNIPPET_EN,
    ].join('\n\n');

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      max_tokens: 240,
      temperature: 0.5,
    });
    const raw = res.choices[0]?.message?.content?.trim() ?? '';
    if (!raw || raw.length < 12) return base;
    const cleaned = normalizeAutomationDashes(scrubAiTypography(raw)).trim();
    return cleaned || base;
  } catch {
    return base;
  }
}

/**
 * Message WhatsApp court après une visite caisse : client fidèle qui revient après une absence notable.
 */
export async function buildWelcomeBackWhatsAppBody(args: {
  commerceName: string;
  prenom: string;
  daysSinceLastVisit: number;
  lifetimeVisitsBefore: number;
  locale?: string | null;
}): Promise<string> {
  const loc = normalizeAppLocale(args.locale ?? undefined);
  const t = createServerTranslator('Dashboard.bananoLoyaltyAi', loc);
  const tCompose = createServerTranslator('Dashboard.bananoAutomationCompose', loc);
  const c = args.commerceName.trim() || tCompose('establishment_fallback');
  const bucket = absenceBucketLabel(args.daysSinceLastVisit, loc);
  const openai = getOpenAI();

  let middle = t('welcome_back_fallback_middle');
  if (openai) {
    try {
      const system = [
        WELCOME_BACK_SYSTEM_EN,
        t('ai_output_language_instruction'),
        REPUTEXA_CROSS_CUT_AI_VOICE_EN,
        HUMAN_KEYBOARD_CHARTER_SNIPPET_EN,
      ].join('\n\n');

      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: JSON.stringify({
              days_absent: args.daysSinceLastVisit,
              absence_bucket_hint: bucket,
              lifetime_visits_before: args.lifetimeVisitsBefore,
              shop_label: c,
            }),
          },
        ],
        max_tokens: 180,
        temperature: 0.55,
      });
      const raw = res.choices[0]?.message?.content?.trim() ?? '';
      if (raw.length >= 12) {
        middle = normalizeAutomationDashes(scrubAiTypography(raw)).trim() || middle;
      }
    } catch {
      /* keep fallback */
    }
  }

  const prenom = args.prenom.trim();
  const greeting = prenom
    ? t('welcome_back_greeting_named', { prenom, commerceName: c })
    : t('welcome_back_greeting_anon', { commerceName: c });

  return normalizeAutomationDashes(
    `${greeting} ${middle} ${t('welcome_back_closing')}`.replace(/\s{2,}/g, ' ').trim()
  );
}
