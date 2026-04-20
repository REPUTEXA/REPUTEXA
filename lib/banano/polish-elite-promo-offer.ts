import OpenAI from 'openai';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

const SYSTEM_EN = `
You rewrite ONLY the middle "offer" paragraph for a private WhatsApp message to a very loyal customer.
The full message ALREADY contains: shop name, "Bonjour {first_name}", and a warm thank-you for loyalty for month_label. Your output is ONLY the promotional detail that goes after that — NOT a second greeting.
The draft_offer is often the SAME commercial base for every recipient (same discount %, product, dates): you MUST keep that deal identical for all, but wording, rhythm, and micro-phrasing MUST differ between recipients (use recipient_variant and member_key).
Hard rules:
- Preserve every factual deal element from the draft: percentages, amounts, product names, dates, conditions. Never invent or change numbers.
- NEVER use the words "champion", "championne", "Champion", or equivalent in any language. Never say they "won" a title or rank. Loyalty thanks are already above your block.
- Do NOT start with "Bonjour", "Cher/Chère", "Pour vous", or the customer's first name — no salutation, no duplicate hello.
- Warm, human, WhatsApp-native (like a friendly shop note). Vary rhythm; avoid stiff corporate tone.
- 0, 1 or 2 emojis total in your paragraph if they fit naturally. Never a row of emojis.
- Output language: follow target_locale (BCP-47). For fr: default to formal "vous" unless merchant_dna clearly asks for informal "tu".
- Length: stay close to the draft, max about 1.5x the draft length.
Return ONLY the rewritten offer paragraph: no quotes, no leading "Voici … :" label, no bullet list unless the draft was already bullets.
`.trim();

function scrubElitePromoOfferText(s: string): string {
  let out = s.trim();
  out = out.replace(/\bchampion(?:ne)?s?\b/giu, 'fidèle');
  out = out.replace(/^\s*Pour vous,?\s+/iu, '');
  out = out.replace(/^\s*Cher(?:e)?\s+\S+,?\s+/iu, '');
  out = out.replace(/^\s*Bonjour[,!\s]*/iu, '');
  return out.replace(/\s{2,}/g, ' ').trim();
}

export type PolishElitePromoInput = {
  draftOffer: string;
  /** profiles.language */
  locale: string | null | undefined;
  establishmentName: string;
  firstName: string;
  monthLabel: string;
  favoriteDetail?: string | null;
  rank?: number;
  visitCount?: number;
  revenueLabel?: string;
  memberId: string;
  /** profiles.ai_custom_instructions (tone DNA) */
  merchantDna?: string | null;
};

export async function polishElitePromoOffer(input: PolishElitePromoInput): Promise<string> {
  const draft = input.draftOffer.trim();
  if (!draft) return draft;

  const openai = getOpenAI();
  if (!openai) return draft;

  const loc = normalizeAppLocale(input.locale ?? undefined);

  let recipientVariant = 0;
  for (let i = 0; i < input.memberId.length; i++) {
    recipientVariant = (recipientVariant + input.memberId.charCodeAt(i)) % 5;
  }
  if (typeof input.rank === 'number') {
    recipientVariant = (recipientVariant + input.rank) % 5;
  }

  const payload = {
    target_locale: loc,
    establishment: (input.establishmentName || 'Shop').trim(),
    first_name: (input.firstName || 'client').trim(),
    month_label: input.monthLabel.trim(),
    favorite_detail: (input.favoriteDetail ?? '').trim() || null,
    rank: input.rank ?? null,
    visit_count: input.visitCount ?? null,
    revenue_label: (input.revenueLabel ?? '').trim() || null,
    recipient_variant: recipientVariant,
    member_key: input.memberId.slice(0, 8),
    merchant_dna: (input.merchantDna ?? '').trim().slice(0, 1200) || null,
    draft_offer: draft,
  };

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.85,
      max_tokens: 500,
      messages: [
        { role: 'system', content: SYSTEM_EN },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim() ?? '';
    if (!raw || raw.length < 8) return draft;
    const cleaned = scrubElitePromoOfferText(
      scrubAiTypography(raw)
        .replace(/^["'«»]+|["'«»]+$/g, '')
        .replace(/^Voici[^:]*:\s*/i, '')
        .trim()
    );
    return cleaned || draft;
  } catch (e) {
    console.error('[polishElitePromoOffer]', e);
    return draft;
  }
}
