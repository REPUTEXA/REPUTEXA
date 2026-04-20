import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWalletPresetById } from '@/lib/banano/wallet-design-presets';
import { parseSafeHex7, sanitizeWalletPreviewCss } from '@/lib/banano/wallet-design-css-sanitize';
import { isWalletThemeIllustrationId, WALLET_THEME_IDS } from '@/lib/banano/wallet-theme-illustrations';

const DEFAULT_BG = '#0f172a';
const DEFAULT_FG = '#fef3c7';
const DEFAULT_LAB = '#94a3b8';

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { presetId?: string; prompt?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.presetId === 'string' && body.presetId.trim()) {
    const preset = getWalletPresetById(body.presetId.trim());
    if (!preset) {
      return NextResponse.json({ error: 'unknown_preset' }, { status: 400 });
    }
    return NextResponse.json({
      background_color: preset.background_color,
      foreground_color: preset.foreground_color,
      label_color: preset.label_color,
      custom_css: preset.custom_css,
      rationale: null as string | null,
      logo_text_suggestion: null as string | null,
      illustration_theme: preset.id,
    });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 2000) {
    return NextResponse.json({ error: 'invalid_prompt' }, { status: 400 });
  }

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json({ error: 'openai_unavailable' }, { status: 503 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('establishment_name')
    .eq('id', user.id)
    .maybeSingle();
  const establishmentName =
    typeof profile?.establishment_name === 'string' ? profile.establishment_name.trim() : '';

  const themeList = WALLET_THEME_IDS.join(', ');
  const system = `Tu es directeur artistique senior pour des cartes magasin Apple Wallet (Passes).
Réponds UNIQUEMENT par un JSON valide avec ces clés exactes :
- background_color, foreground_color, label_color : couleurs hex sur 7 caractères (#rrggbb), contrastes lisibles sur mobile.
- illustration_theme : OBLIGATOIRE — choisis UN id parmi exactement : ${themeList}. Il sert à afficher une illustration vectorielle plein cadre dans l'aperçu (fichiers /wallet-pass-themes/{id}.svg). Choisis celui qui correspond le mieux au secteur décrit (ex. boucherie → butcher, boulangerie → bakery).
- custom_css : chaîne optionnelle ou null. CSS uniquement pour l'APERÇU web (pas téléchargé dans le .pkpass). Cible EXCLUSIVEMENT :
  • .wallet-pass-preview-card — dégradés / ombre par-dessus l’illustration
  • .wallet-pass-preview-strip — bandeau central
  • .wallet-pass-preview-ambient — halos
  N'utilise jamais url(), @import, ni javascript. Maximum 3500 caractères.
- logo_text_suggestion : optionnel, string courte (≤28 caractères) pour le titre sur la carte (ou null).
- rationale : une phrase courte en français expliquant le choix (≤200 caractères).

Viser un rendu premium, sobre, homogène avec l’illustration choisie.`;

  const userMsg = `Commerce${establishmentName ? ` : « ${establishmentName} »` : ''}.
Demande du marchand pour l'ambiance du passe Wallet :
${prompt}`;

  let content: string;
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_WALLET_DESIGN_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0.55,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
    });
    content = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!content) {
      return NextResponse.json({ error: 'model_empty' }, { status: 502 });
    }
  } catch (e) {
    console.error('[banano/wallet/design/suggest]', e);
    return NextResponse.json({ error: 'model_error' }, { status: 502 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'model_output_invalid' }, { status: 502 });
  }

  const background_color = parseSafeHex7(parsed.background_color, DEFAULT_BG);
  const foreground_color = parseSafeHex7(parsed.foreground_color, DEFAULT_FG);
  const label_color = parseSafeHex7(parsed.label_color, DEFAULT_LAB);

  let custom_css: string | null = null;
  if (typeof parsed.custom_css === 'string') {
    custom_css = sanitizeWalletPreviewCss(parsed.custom_css);
  }

  let logo_text_suggestion: string | null = null;
  if (typeof parsed.logo_text_suggestion === 'string') {
    const s = parsed.logo_text_suggestion.trim().slice(0, 28);
    logo_text_suggestion = s.length > 0 ? s : null;
  }

  let rationale: string | null = null;
  if (typeof parsed.rationale === 'string') {
    const r = parsed.rationale.trim().slice(0, 200);
    rationale = r.length > 0 ? r : null;
  }

  let illustration_theme: string | null = null;
  if (typeof parsed.illustration_theme === 'string' && isWalletThemeIllustrationId(parsed.illustration_theme.trim())) {
    illustration_theme = parsed.illustration_theme.trim();
  }

  return NextResponse.json({
    background_color,
    foreground_color,
    label_color,
    custom_css,
    rationale,
    logo_text_suggestion,
    illustration_theme,
  });
}
