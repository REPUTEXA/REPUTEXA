import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { requireFeature } from '@/lib/api-plan-guard';
import { FEATURES } from '@/lib/feature-gate';

/**
 * Prépare le dossier de signalement Google (action manuelle obligatoire).
 * Google Business Profile n'expose pas d'API publique pour demander la suppression d'un avis —
 * l'IA rédige le texte ; le professionnel envoie sur la plateforme Google.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const locale = apiLocaleFromRequest(request);
    const t = createServerTranslator('Api', locale);

    const planCheck = await requireFeature(FEATURES.SHIELD_HATEFUL);
    if (planCheck instanceof NextResponse) return planCheck;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const { data: review } = await supabase
      .from('reviews')
      .select(
        'id, comment, source, is_toxic, toxicity_reason, toxicity_legal_argumentation, toxicity_complaint_text'
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!review) {
      return apiJsonError(request, 'errors.reviewNotFound', 404);
    }

    const legal =
      typeof review.toxicity_legal_argumentation === 'string' ? review.toxicity_legal_argumentation.trim() : '';
    const hasDossier =
      review.is_toxic === true || legal.length > 0;

    if (!hasDossier) {
      return apiJsonError(request, 'errors.shieldReportDossierMissing', 422);
    }

    return NextResponse.json({
      id,
      status: 'ready_for_manual_google_submit',
      message: t('shieldReport_readyMessage'),
      googleGuideUrl: t('shieldReport_googleRemoveHelpUrl'),
      motive: review.toxicity_reason ?? null,
      dossierPreview: legal ? `${legal.slice(0, 500)}${legal.length > 500 ? '…' : ''}` : null,
      complaintPreview:
        typeof review.toxicity_complaint_text === 'string' && review.toxicity_complaint_text.trim()
          ? `${review.toxicity_complaint_text.trim().slice(0, 400)}${
              review.toxicity_complaint_text.trim().length > 400 ? '…' : ''
            }`
          : null,
    });
  } catch (error) {
    console.error('[supabase/reviews/shield-report]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
