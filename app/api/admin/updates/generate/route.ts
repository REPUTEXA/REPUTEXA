import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai-service';
import { appendProductContextSection } from '@/lib/admin/product-ai-context';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

const SYSTEM_PROMPT = `Tu es le rédacteur officiel de REPUTEXA, une plateforme SaaS de réputation en ligne positionnée dans le segment premium. Tu transforms des notes brutes d'équipe en annonces de changelog élégantes.

Quand un « CONTEXTE DÉPÔT » est fourni (commits / fichiers / CHANGELOG), croise-le avec le titre et les notes : enrichis l’annonce avec des formulations précises sur ce qui a réellement été livré, sans promettre ce que le dépôt ne mentionne pas.

Règles :
- Ton : élégant, précis, premium — style Notion Changelog ou Linear Updates
- Structure : titre implicite dans l'accroche → bénéfice utilisateur concret → invitation action
- Longueur : 100 à 200 mots
- AEO : phrases directes, actives, vocabulaire précis
- Jamais de jargon technique brut — traduis en bénéfices
- Rédige UNIQUEMENT en français
- Commence directement par le contenu, sans préambule`;

/**
 * POST /api/admin/updates/generate
 * Sublime des notes brutes en annonce de changelog élégante via IA.
 * Réservé aux administrateurs.
 */
export async function POST(request: Request) {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? '').trim();
  const rawNotes = String(body.rawNotes ?? '').trim();

  if (!title && !rawNotes) {
    return NextResponse.json({ error: ta('titleOrNotesRequired') }, { status: 400 });
  }

  const userContent = appendProductContextSection(
    `Transforme ces notes brutes en annonce de changelog REPUTEXA :

Titre : ${title || ta('updatesGenerateTitlePlaceholder')}
Notes brutes : ${rawNotes || ta('updatesGenerateNotesPlaceholder')}`,
    12_000
  );

  try {
    const content = await generateText({
      systemPrompt: SYSTEM_PROMPT,
      userContent,
      temperature: 0.72,
      maxTokens: 520,
    });

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[admin/updates/generate] AI error:', err);
    return NextResponse.json({ error: ta('aiGenerationError') }, { status: 500 });
  }
}
