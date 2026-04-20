import { apiJsonError } from '@/lib/api/api-error-response';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai-service';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { dashboardLocaleFromRequest } from '@/lib/api/request-dashboard-locale';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import type { SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';

const TARGET_LANGUAGE_EN: Record<SiteLocaleCode, string> = {
  fr: 'French',
  en: 'English (US)',
  'en-gb': 'English (UK)',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
};

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

/**
 * POST /api/app-suggestions/[id]/translate
 * Traduit titre + description dans la langue du dashboard (cookie ou body.target_locale).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { id } = await params;
  if (!id) {
    return apiJsonError(request, 'missingId', 400);
  }

  const body = await request.json().catch(() => ({}));
  const targetLocale = normalizeAppLocale(
    typeof body.target_locale === 'string' ? body.target_locale : dashboardLocaleFromRequest(request)
  ) as SiteLocaleCode;

  const tApi = createServerTranslator('ApiAppSuggestions', targetLocale);
  const langName = TARGET_LANGUAGE_EN[targetLocale] ?? 'English';

  const { data: row, error } = await supabase
    .from('app_suggestions')
    .select('id, title, description')
    .eq('id', id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: tApi('translateNotFound') }, { status: 404 });
  }

  const title = String(row.title ?? '').trim();
  const description = String(row.description ?? '').trim();
  if (!title && !description) {
    return NextResponse.json({ error: tApi('translateEmpty') }, { status: 400 });
  }

  const systemPrompt = `You are a professional translator for a SaaS product community wall.
Output ONLY valid JSON (no markdown fences): {"title":"...","description":"..."}
Both keys must be present. "description" may be an empty string if the source is empty.
Translate naturally into ${langName}. Keep the brand name REPUTEXA unchanged if it appears.
Preserve line breaks in description as \\n where appropriate.`;

  const userContent = `Source title:\n${title || '(empty)'}\n\nSource description:\n${description || '(empty)'}`;

  try {
    const raw = await generateText({
      systemPrompt,
      userContent,
      temperature: 0.2,
      maxTokens: 4_096,
    });
    const parsed = extractJsonObject(raw) as { title?: unknown; description?: unknown } | null;
    const outTitle = typeof parsed?.title === 'string' ? parsed.title.trim() : '';
    const outDesc = typeof parsed?.description === 'string' ? parsed.description.trim() : '';
    if (!outTitle && !outDesc) {
      return NextResponse.json({ error: tApi('translateParseError') }, { status: 500 });
    }
    return NextResponse.json({
      title: outTitle || title,
      description: outDesc,
    });
  } catch (e) {
    console.error('[app-suggestions/translate]', e);
    return NextResponse.json({ error: tApi('translateAiError') }, { status: 500 });
  }
}
