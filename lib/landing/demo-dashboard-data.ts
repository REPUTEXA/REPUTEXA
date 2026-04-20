import frMessages from '@/messages/fr.json';
import enMessages from '@/messages/en.json';

export type DemoReviewTone = 'positive' | 'negative' | 'hateful';
export type DemoReviewPresetParam = DemoReviewTone | 'random';

export type DemoDashboardExample = {
  sector: string;
  business: string;
  reviewer: string;
  review: string;
  response: string;
  rating: number;
  phone?: string;
  email?: string;
  /** Ville / zone pour SEO local dans les prompts */
  city?: string;
  /** Mots-clés métier discrets (ex. « salon bio Paris 11 ») — jamais listés en vrac dans la réponse */
  seoContext?: string;
  /** Fiche avis (démo Shield) */
  platformLabel?: string;
  /** Scénario démo : adapte les prompts IA */
  reviewTone: DemoReviewTone;
};

const CONTACT_BY_INDEX: Record<number, { phone?: string; email?: string }> = {
  0: { phone: '+33 1 23 45 67 89' },
  1: { phone: '+33 1 58 96 32 10', email: 'contact@bistro-parisien.fr' },
  2: { phone: '+33 4 72 11 22 33' },
  3: { email: 'contact@spa-zenitude.fr' },
  4: { phone: '+33 1 44 55 66 77' },
};

function messagesForLocale(locale: string) {
  return (locale === 'fr' ? frMessages : enMessages) as typeof frMessages;
}

export function parseDemoReviewPreset(raw: string | null | undefined): DemoReviewPresetParam {
  if (raw === 'positive' || raw === 'negative' || raw === 'hateful' || raw === 'random') {
    return raw;
  }
  return 'random';
}

export function resolveRandomDemoTone(): DemoReviewTone {
  const pool: DemoReviewTone[] = ['positive', 'negative', 'hateful'];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Même ton côté client et serveur lorsque preset === 'random'. */
export function resolveRandomDemoToneFromSeed(seed: number): DemoReviewTone {
  const pool: DemoReviewTone[] = ['positive', 'negative', 'hateful'];
  const s = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 0;
  return pool[s % pool.length]!;
}

export function parseDemoRandomSeed(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) {
    return Math.floor(Number(raw));
  }
  return undefined;
}

type RawVariant = {
  sector?: string;
  business?: string;
  reviewer?: string;
  review?: string;
  response?: string;
  rating?: number;
  phone?: string;
  email?: string;
  city?: string;
  seoContext?: string;
  platformLabel?: string;
};

type RawPreset =
  | RawVariant
  | {
      variants?: RawVariant[];
    };

function pickVariantIndex(
  seed: number | undefined,
  tone: DemoReviewTone,
  count: number
): number {
  if (count <= 1) return 0;
  const s = Number.isFinite(seed) ? Math.floor(Math.abs(seed!)) : Math.floor(Math.random() * 1e9);
  const salt = tone === 'positive' ? 11 : tone === 'negative' ? 29 : 47;
  return (s + salt) % count;
}

function normalizeVariant(raw: RawVariant | undefined, resolvedTone: DemoReviewTone): DemoDashboardExample | null {
  if (!raw || typeof raw.review !== 'string') return null;
  const rating =
    typeof raw.rating === 'number' && raw.rating >= 1 && raw.rating <= 5 ? raw.rating : 3;
  return {
    sector: String(raw.sector ?? ''),
    business: String(raw.business ?? ''),
    reviewer: String(raw.reviewer ?? ''),
    review: raw.review,
    response: String(raw.response ?? ''),
    rating,
    phone: raw.phone,
    email: raw.email,
    city: raw.city ? String(raw.city) : undefined,
    seoContext: raw.seoContext ? String(raw.seoContext) : undefined,
    platformLabel: raw.platformLabel ? String(raw.platformLabel) : undefined,
    reviewTone: resolvedTone,
  };
}

export function getDemoExampleFromPreset(
  locale: string,
  preset: DemoReviewPresetParam,
  randomSeed?: number
): { example: DemoDashboardExample; resolvedTone: DemoReviewTone } {
  const resolvedTone =
    preset === 'random'
      ? resolveRandomDemoToneFromSeed(randomSeed ?? Math.floor(Math.random() * 1e9))
      : preset;
  const m = messagesForLocale(locale);
  const presetRaw = m.HomePage?.demo?.reviewPresets?.[resolvedTone] as RawPreset | undefined;

  const variants: RawVariant[] =
    presetRaw &&
    typeof presetRaw === 'object' &&
    'variants' in presetRaw &&
    Array.isArray(presetRaw.variants)
      ? presetRaw.variants
      : presetRaw && typeof presetRaw === 'object' && 'review' in presetRaw && presetRaw.review
        ? [presetRaw as RawVariant]
        : [];

  const idx = pickVariantIndex(randomSeed, resolvedTone, variants.length);
  const chosen = variants[idx];
  const normalized = normalizeVariant(chosen, resolvedTone);

  if (normalized) {
    return { example: normalized, resolvedTone };
  }

  const fallback = getDemoDashboardExample(locale, 0);
  const ex = fallback ?? {
    sector: 'salon',
    business: 'Salon',
    reviewer: 'Client',
    review: 'Avis.',
    response: 'Réponse.',
    rating: 2,
    reviewTone: 'negative' as const,
  };
  return { example: { ...ex, reviewTone: resolvedTone }, resolvedTone };
}

/** @deprecated Présets scénario — préférer getDemoExampleFromPreset */
export function getDemoDashboardExample(
  locale: string,
  index: number
): DemoDashboardExample | null {
  if (!Number.isInteger(index) || index < 0 || index > 4) return null;
  const key = String(index) as '0' | '1' | '2' | '3' | '4';
  const m = messagesForLocale(locale);
  const raw = m.HomePage?.demo?.examples?.[key];
  if (!raw || typeof raw.review !== 'string') return null;
  const contact = CONTACT_BY_INDEX[index] ?? {};
  return {
    sector: String(raw.sector ?? ''),
    business: String(raw.business ?? ''),
    reviewer: String(raw.reviewer ?? ''),
    review: raw.review,
    response: String(raw.response ?? ''),
    rating: 2,
    reviewTone: 'negative',
    ...contact,
  };
}

export function clampDemoExampleIndex(index: number): number {
  if (!Number.isFinite(index)) return Math.floor(Math.random() * 5);
  return Math.max(0, Math.min(4, Math.floor(index)));
}
