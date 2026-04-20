/**
 * API Route unifiée : génération de réponse aux avis
 * Utilise le moteur central (lib/ai-service.ts) avec injection de l'ADN client.
 * Server-side only — aucune clé API exposée au navigateur.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateReviewResponse } from '@/lib/ai-service';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

type GenerateBody = {
  /** Avis client (requis) */
  avis: string;
  /** Nom du client (optionnel) */
  reviewerName?: string;
  /** Note /5 (optionnel) */
  rating?: number;
  /** Ton : professional | warm | casual | luxury | humorous (override profil) */
  ton?: string;
  /** Longueur : concise | balanced | detailed (override profil) */
  longueur?: string;
  /** Instructions spécifiques (override profil) */
  instructions?: string;
  /** Nom de l'établissement (override profil) */
  establishmentName?: string;
  /** Langue cible (override profil) */
  language?: string;
  /** Si true, utilise uniquement le body (prévisualisation ADN, pas de fetch profil) */
  previewOnly?: boolean;
};

export async function POST(request: Request) {
  const tAi = createServerTranslator('ApiAi', apiLocaleFromRequest(request));
  try {
    const body = (await request.json().catch(() => ({}))) as GenerateBody;
    const avis = String(body.avis ?? '').trim();
    if (!avis) {
      return apiJsonError(request, 'errors.ai_reviewRequired', 400);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let ton = String(body.ton ?? '').trim();
    let longueur = String(body.longueur ?? '').trim();
    let instructions = String(body.instructions ?? '').trim();
    let establishmentName = String(body.establishmentName ?? '').trim();
    const language = String(body.language ?? 'fr').trim();
    const reviewerName = String(body.reviewerName ?? 'Client').trim();
    const rating = typeof body.rating === 'number' ? body.rating : 5;

    let phone = '';
    let email = '';

    if (!body.previewOnly && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('establishment_name, ai_tone, ai_length, ai_custom_instructions, language, phone, email')
        .eq('id', user.id)
        .single();

      if (profile) {
        if (!establishmentName) establishmentName = (profile.establishment_name as string)?.trim() ?? '';
        if (!ton) ton = (profile.ai_tone as string) ?? 'professional';
        if (!longueur) longueur = (profile.ai_length as string) ?? 'balanced';
        if (!instructions) instructions = (profile.ai_custom_instructions as string) ?? '';
        phone = (profile.phone as string)?.trim() ?? '';
        email = (profile.email as string)?.trim() ?? '';
      }
    }

    const nomEtablissement = establishmentName || tAi('defaultEstablishment');

    const result = await generateReviewResponse({
      avis,
      reviewerName,
      rating,
      ton: ton || 'professional',
      longueur: longueur || 'balanced',
      instructions,
      establishmentName: nomEtablissement,
      language: language || 'fr',
      phone: phone || undefined,
      email: email || undefined,
    });

    return NextResponse.json({
      content: result.content,
      detectedLanguage: 'fr',
    });
  } catch (err) {
    console.error('[api/ai/generate]', err);
    return apiJsonError(request, 'serverError', 500);
  }
}
