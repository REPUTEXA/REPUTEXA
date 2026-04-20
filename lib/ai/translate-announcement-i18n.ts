import { generateText } from '@/lib/ai-service';
import { SITE_LOCALE_CODES, type SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

const CODES_LIST = SITE_LOCALE_CODES.join(', ');

function uniformMaps(title: string, content: string): {
  title_i18n: Record<SiteLocaleCode, string>;
  content_i18n: Record<SiteLocaleCode, string>;
} {
  const title_i18n = {} as Record<SiteLocaleCode, string>;
  const content_i18n = {} as Record<SiteLocaleCode, string>;
  for (const c of SITE_LOCALE_CODES) {
    title_i18n[c] = title;
    content_i18n[c] = content;
  }
  return { title_i18n, content_i18n };
}

function extractJsonObject(text: string): unknown {
  const t = text.trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coerceLocaleMap(
  raw: unknown,
  field: 'titles' | 'contents'
): Partial<Record<SiteLocaleCode, string>> | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const bucket = obj[field];
  if (!bucket || typeof bucket !== 'object') return null;
  const out: Partial<Record<SiteLocaleCode, string>> = {};
  for (const code of SITE_LOCALE_CODES) {
    const v = (bucket as Record<string, unknown>)[code];
    if (typeof v === 'string' && v.trim()) out[code] = v.trim();
  }
  return out;
}

/**
 * Traduit titre + corps d’un communiqué produit vers toutes les locales du site (une passe IA).
 * En cas d’échec ou de JSON invalide : même texte pour toutes les langues (repli).
 */
export async function translateTitleAndContentToAllLocales(params: {
  title: string;
  content: string;
  sourceLocale: string;
}): Promise<{ title_i18n: Record<string, string>; content_i18n: Record<string, string> }> {
  const title = params.title.trim();
  const content = params.content.trim();
  const sourceLocale = normalizeAppLocale(params.sourceLocale);

  if (!title && !content) {
    const u = uniformMaps(title, content);
    return { title_i18n: u.title_i18n, content_i18n: u.content_i18n };
  }

  const systemPrompt = `You are a professional product-localization translator for REPUTEXA (reputation SaaS).

Output ONLY a single JSON object (no markdown fences, no commentary). Keys must be exactly "titles" and "contents".
Each of "titles" and "contents" must be an object with ALL of these locale keys present: ${CODES_LIST}.

Rules:
- Natural, idiomatic marketing/changelog tone per locale; not literal word-for-word if it reads badly.
- Keep the brand name "REPUTEXA" unchanged.
- Preserve meaning and structure (paragraph breaks in "contents" as \\n where appropriate).
- Source language of the input is ${sourceLocale}; translate appropriately into every target locale.

Example shape:
{"titles":{"fr":"...","en":"...","es":"...","de":"...","it":"...","pt":"...","ja":"...","zh":"..."},"contents":{"fr":"...","en":"...",...}}`;

  const userContent = `Translate the following announcement into every required locale.

HEADLINE (source):
${title || '(empty)'}

BODY (source):
${content || '(empty)'}`;

  try {
    const raw = await generateText({
      systemPrompt,
      userContent,
      temperature: 0.25,
      maxTokens: 12_000,
    });
    const parsed = extractJsonObject(raw);
    const titles = coerceLocaleMap(parsed, 'titles');
    const contents = coerceLocaleMap(parsed, 'contents');
    if (!titles || !contents) {
      return uniformMaps(title || params.title, content || params.content);
    }
    const title_i18n: Record<string, string> = {};
    const content_i18n: Record<string, string> = {};
    for (const code of SITE_LOCALE_CODES) {
      title_i18n[code] = titles[code] ?? title;
      content_i18n[code] = contents[code] ?? content;
    }
    return { title_i18n, content_i18n };
  } catch (e) {
    console.error('[translate-announcement-i18n]', e);
    const u = uniformMaps(title || params.title, content || params.content);
    return { title_i18n: u.title_i18n, content_i18n: u.content_i18n };
  }
}
