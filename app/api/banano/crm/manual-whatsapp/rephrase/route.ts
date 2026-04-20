import { NextResponse } from 'next/server';
import { apiIaJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { classifyOpenAiIaFailure } from '@/lib/api/classify-openai-ia-error';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { HUMAN_KEYBOARD_CHARTER_SNIPPET } from '@/lib/ai/human-keyboard-output';
import { REPUTEXA_CROSS_CUT_AI_VOICE } from '@/lib/ai/reputexa-cross-cut-voice';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';

export const dynamic = 'force-dynamic';

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

type LoyaltyContext = {
  /** Scénario fidélité pour harmoniser le ton (mémoire client, complicité). */
  scenario?: 'lost_client' | 'birthday' | 'vip_of_month' | 'welcome_back' | 'manual';
  /** Jours depuis dernière visite (relance / retour). */
  days_inactive?: number;
  prenom?: string;
};

type Body = { draft?: string; loyalty_context?: LoyaltyContext };

export async function POST(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const openai = getOpenAI();
  if (!openai) {
    return apiIaJsonError(req, 'openAiNotConfigured', 503);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const draft = String(body.draft ?? '').trim();
  const loyaltyCtx = body.loyalty_context;
  if (draft.length < 3) {
    return apiIaJsonError(req, 'draftTooShort', 400);
  }
  if (draft.length > 3500) {
    return apiIaJsonError(req, 'draftTooLong', 400);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('establishment_name')
    .eq('id', user.id)
    .maybeSingle();
  const commerceName =
    ((profile as { establishment_name?: string } | null)?.establishment_name ?? '').trim() ||
    tm('crmManualWhatsappCommerceFallback');

  const loyaltyExtra =
    loyaltyCtx?.scenario && loyaltyCtx.scenario !== 'manual'
      ? [
          tm('crmManualWhatsappLoyaltyBlockIntro'),
          loyaltyCtx.scenario === 'lost_client'
            ? tm('crmManualWhatsappLoyaltyScenarioLost')
            : loyaltyCtx.scenario === 'welcome_back'
              ? tm('crmManualWhatsappLoyaltyScenarioWelcomeBack')
              : loyaltyCtx.scenario === 'birthday'
                ? tm('crmManualWhatsappLoyaltyScenarioBirthday')
                : tm('crmManualWhatsappLoyaltyScenarioVip'),
          typeof loyaltyCtx.days_inactive === 'number' && loyaltyCtx.days_inactive > 0
            ? tm('crmManualWhatsappLoyaltyDaysInactive', { days: loyaltyCtx.days_inactive })
            : '',
          loyaltyCtx.prenom?.trim()
            ? tm('crmManualWhatsappLoyaltyFirstNameHint', { firstName: loyaltyCtx.prenom.trim() })
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: [
            tm('crmManualWhatsappRephraseSystemIntro', { commerceName }),
            tm('crmManualWhatsappRephraseSystemInstructionTone'),
            tm('crmManualWhatsappRephraseSystemNoLegalAds'),
            loyaltyExtra,
            REPUTEXA_CROSS_CUT_AI_VOICE,
            HUMAN_KEYBOARD_CHARTER_SNIPPET,
            tm('crmManualWhatsappRephraseSystemReplyPlain'),
          ]
            .filter(Boolean)
            .join('\n'),
        },
        { role: 'user', content: draft },
      ],
      max_tokens: 700,
      temperature: 0.45,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!raw) {
      return apiIaJsonError(req, 'modelEmptyResponse', 502);
    }

    const text = scrubAiTypography(raw).trim();
    return NextResponse.json({ text });
  } catch (e) {
    console.error('[manual-whatsapp/rephrase]', e);
    const key = classifyOpenAiIaFailure(e);
    return apiIaJsonError(req, key, 503);
  }
}
