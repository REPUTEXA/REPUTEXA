import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { calculateScheduledAt, isPositiveReview, generateQuickReplyToken } from '@/lib/reviews/queue';
import { nextOpeningPatternIndex } from '@/lib/reviews/opening-pattern';
import { getActiveLocationIdFromCookie } from '@/lib/active-location-cookie';
import { validateEstablishmentId } from '@/lib/validate-establishment';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { HUMAN_FALLBACKS } from '@/lib/ai/concierge-prompts';
import { produceAutomatedReviewReplyResult } from '@/lib/ai/review-reply-brain';
import { hasAiConfigured } from '@/lib/ai-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeIngestPlatformReviewWebhook, countOmniPriorReviewerMemories } from '@/lib/omni-synapse';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ToxicCategory = 'none' | 'hate_or_threat' | 'doxxing' | 'spam_or_ad' | 'conflict_of_interest';

type ToxicityAnalysis = {
  isToxic: boolean;
  reason: string | null;
  complaintText: string | null;
  legalArgumentation: string | null;
};

async function detectToxicReview(comment: string, platformLabel: string): Promise<ToxicityAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    return { isToxic: false, reason: null, complaintText: null, legalArgumentation: null };
  }

  const trimmed = comment.trim();
  if (!trimmed) {
    return { isToxic: false, reason: null, complaintText: null, legalArgumentation: null };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Tu es un modérateur spécialisé en e-réputation pour restaurants français. ' +
            'Ta mission : 1) détecter si un avis client est TOXIC selon 4 motifs précis, ' +
            '1) Haine / menace (insultes, propos discriminatoires, menaces explicites ou voilées) ' +
            '2) Doxxing (numéros de téléphone, adresses, noms complets de personnes privées) ' +
            '3) Spam / publicité (promotion d’un autre établissement, lien commercial, message automatisé) ' +
            "4) Conflit d'intérêt (concurrent évident, faux avis, chantage explicite lié à un avantage). " +
            '2) générer, si l’avis est TOXIC, une plainte formelle et froide (legal_argumentation) adressée aux modérateurs de la plateforme, citant les violations des conditions d’utilisation. ' +
            'Réponds UNIQUEMENT en JSON : ' +
            '{ "category": "none|hate_or_threat|doxxing|spam_or_ad|conflict_of_interest", "full_complaint_text": "<texte>", "legal_argumentation": "<texte>" }. ' +
            'Ne marque TOXIC que si le motif est clair (Haine, Doxxing, Spam ou Conflit d’intérêt). ' +
            'legal_argumentation : texte formel, froid et percutant, ton juridique, en français, citant les conditions d’utilisation violées. Prêt à être copié-collé dans un formulaire de signalement.',
        },
        {
          role: 'user',
          content:
            `Plateforme : ${platformLabel}.\n` +
            'Analyse cet avis client et détermine s’il est toxique ou non. ' +
            'Si tu conclus qu’il est TOXIC, rédige ensuite une plainte formelle et persuasive destinée aux modérateurs de cette plateforme, ' +
            'en expliquant que l’avis enfreint les conditions d’utilisation liées à la catégorie détectée (motif). ' +
            'Le texte doit être prêt à être copié-collé par un restaurateur pour demander la suppression de l’avis.\n\n' +
            `Avis:\n"""${trimmed}"""`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    let parsed: { category?: ToxicCategory; full_complaint_text?: string; legal_argumentation?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
    const category: ToxicCategory = parsed.category ?? 'none';
    const fullComplaintTextRaw =
      typeof parsed.full_complaint_text === 'string' ? parsed.full_complaint_text : '';
    const legalArgumentationRaw =
      typeof parsed.legal_argumentation === 'string' ? parsed.legal_argumentation : '';
    if (!category || category === 'none') {
      return { isToxic: false, reason: null, complaintText: null, legalArgumentation: null };
    }

    const label =
      category === 'hate_or_threat'
        ? 'Haine / menace'
        : category === 'doxxing'
          ? 'Doxxing (données personnelles)'
          : category === 'spam_or_ad'
            ? 'Spam / publicité'
            : category === 'conflict_of_interest'
              ? "Conflit d'intérêt"
              : 'Contenu toxique';

    const complaintText = fullComplaintTextRaw.trim() || null;
    const legalArgumentation = legalArgumentationRaw.trim() || null;

    return { isToxic: true, reason: label, complaintText, legalArgumentation };
  } catch {
    return { isToxic: false, reason: null, complaintText: null, legalArgumentation: null };
  }
}

/**
 * Liste les avis de l'utilisateur connecté.
 * Filtre par establishment_id si cookie reputexa_active_location présent.
 * Inclut seoKeywords du profil pour afficher le badge Boosté sur le dashboard.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiJsonError(request, 'unauthorized', 401);

  const cookieHeader = request.headers.get('cookie');
  const rawLocationId = getActiveLocationIdFromCookie(cookieHeader);
  const activeLocationId = await validateEstablishmentId(supabase, rawLocationId ?? 'profile');

  let reviewsQuery = supabase
    .from('reviews')
    .select(
      'id, reviewer_name, rating, comment, source, response_text, status, scheduled_at, created_at, ai_response, whatsapp_sent, quick_reply_token, is_toxic, toxicity_reason, toxicity_resolved_at, toxicity_complaint_text, toxicity_legal_argumentation'
    )
    .eq('user_id', user.id);

  if (activeLocationId === 'profile') {
    reviewsQuery = reviewsQuery.is('establishment_id', null);
  } else if (activeLocationId) {
    reviewsQuery = reviewsQuery.eq('establishment_id', activeLocationId);
  }

  const [reviewsRes, profileRes] = await Promise.all([
    reviewsQuery.order('created_at', { ascending: false }),
    supabase.from('profiles').select('seo_keywords, subscription_plan, selected_plan').eq('id', user.id).single(),
  ]);

  if (reviewsRes.error) {
    return NextResponse.json({ error: reviewsRes.error.message }, { status: 500 });
  }

  const seoKeywords = Array.isArray(profileRes.data?.seo_keywords)
    ? profileRes.data.seo_keywords.filter((k): k is string => typeof k === 'string')
    : [];
  const planSlug = toPlanSlug(profileRes.data?.subscription_plan ?? null, profileRes.data?.selected_plan ?? null);
  const hasSeoBoost = hasFeature(planSlug, FEATURES.SEO_BOOST);

  return NextResponse.json({
    reviews: reviewsRes.data ?? [],
    seoKeywords: hasSeoBoost ? seoKeywords : [],
  });
}

/**
 * Crée un avis dans Supabase et applique la file intelligente :
 * - Positif (≥ 3 étoiles, non toxique) → pending_publication, ai_response générée, scheduled_at 2h–7h, cron publie
 * - Négatif ou toxique → pending, alertes / flux manuel selon plan
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { reviewerName, rating, comment, source } = body as {
      reviewerName?: string;
      rating?: number;
      comment?: string;
      source?: string;
    };

    if (!reviewerName?.trim() || rating == null || !comment?.trim()) {
      return apiJsonError(request, 'errors.supabaseReviewBasicsRequired', 400);
    }
    const ratingNum = Number(rating);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return apiJsonError(request, 'errors.ratingRange', 400);
    }

    const raw = (source ?? 'google').toLowerCase();
    const src =
      raw === 'google' || raw === 'facebook' || raw === 'trustpilot' ? raw : 'google';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const cookieHeader = request.headers.get('cookie');
    const rawLocationId = getActiveLocationIdFromCookie(cookieHeader);
    const activeLocationId = await validateEstablishmentId(supabase, rawLocationId ?? 'profile');

    const { data: profileData } = await supabase
      .from('profiles')
      .select(
        'alert_threshold_stars, seo_keywords, subscription_plan, selected_plan, establishment_name, address, whatsapp_phone, language, ai_tone, ai_length, ai_custom_instructions, phone, email, omni_recursive_prompt_addon'
      )
      .eq('id', user.id)
      .single();

    const alertThreshold = profileData?.alert_threshold_stars ?? 3;
    const planSlug = toPlanSlug(profileData?.subscription_plan ?? null, profileData?.selected_plan ?? null);
    const profileLanguage = (profileData?.language as string) ?? 'fr';
    const seoKeywords = Array.isArray(profileData?.seo_keywords)
      ? profileData.seo_keywords.filter((k): k is string => typeof k === 'string').slice(0, 10)
      : [];
    const establishmentName = profileData?.establishment_name?.trim() || 'établissement';
    const businessContext = [seoKeywords[0], profileData?.address?.trim()].filter(Boolean).join(' à ') || establishmentName;
    const isPositive = isPositiveReview(ratingNum);
    const token = generateQuickReplyToken();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sinceIso = sixMonthsAgo.toISOString();
    const estIdForOmni =
      activeLocationId && activeLocationId !== 'profile' ? activeLocationId : null;
    let repeatVisit = false;
    if (reviewerName.trim().length > 0) {
      let rvq = supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('reviewer_name', reviewerName.trim())
        .gte('created_at', sinceIso);
      if (activeLocationId === 'profile') {
        rvq = rvq.is('establishment_id', null);
      } else if (activeLocationId) {
        rvq = rvq.eq('establishment_id', activeLocationId);
      }
      const { count: priorAuthorCount } = await rvq;
      repeatVisit = (priorAuthorCount ?? 0) > 0;
    }
    if (!repeatVisit && reviewerName.trim().length > 0) {
      const adminOmni = createAdminClient();
      if (adminOmni) {
        const omniCount = await countOmniPriorReviewerMemories(adminOmni, {
          userId: user.id,
          establishmentId: estIdForOmni,
          reviewerName: reviewerName.trim(),
          sinceIso,
        });
        repeatVisit = omniCount > 0;
      }
    }

    let lastPublishedReply: string | null = null;
    {
      let pq = supabase
        .from('reviews')
        .select('response_text, ai_response')
        .eq('user_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1);
      if (activeLocationId === 'profile') {
        pq = pq.is('establishment_id', null);
      } else if (activeLocationId) {
        pq = pq.eq('establishment_id', activeLocationId);
      }
      const { data: lastPub } = await pq.maybeSingle();
      if (lastPub) {
        lastPublishedReply =
          (typeof lastPub.response_text === 'string' && lastPub.response_text) ||
          (typeof lastPub.ai_response === 'string' && lastPub.ai_response) ||
          null;
      }
    }
    const openingPatternIdx = nextOpeningPatternIndex(
      comment.trim(),
      reviewerName.trim(),
      lastPublishedReply
    );

    // Détection du caractère toxique de l'avis (haine, doxxing, spam, conflit d'intérêt)
    const platformLabel =
      src === 'google'
        ? 'Google Business Profile'
        : src === 'facebook'
          ? 'Facebook'
          : src === 'trustpilot'
            ? 'Trustpilot'
            : 'la plateforme';
    const toxicity = await detectToxicReview(comment.trim(), platformLabel);

    const insert: Record<string, unknown> = {
      user_id: user.id,
      reviewer_name: reviewerName.trim(),
      rating: ratingNum,
      comment: comment.trim(),
      source: src,
      quick_reply_token: token,
      is_toxic: toxicity.isToxic,
      toxicity_reason: toxicity.reason,
      toxicity_created_at: toxicity.isToxic ? new Date().toISOString() : null,
      toxicity_complaint_text: toxicity.complaintText,
      toxicity_legal_argumentation: toxicity.legalArgumentation,
    };
    if (activeLocationId && activeLocationId !== 'profile') {
      insert.establishment_id = activeLocationId;
    }

    if (isPositive && !toxicity.isToxic) {
      insert.status = 'generating';
      insert.scheduled_at = calculateScheduledAt().toISOString();  // 2h–7h human-like delay

      if (hasAiConfigured()) {
        try {
          const { text: reply, confidence } = await produceAutomatedReviewReplyResult({
            planSlug,
            comment: comment.trim(),
            reviewerName: reviewerName.trim(),
            rating: ratingNum,
            establishmentName,
            businessContext,
            seoKeywords,
            profileLanguage,
            aiTone: profileData?.ai_tone as string | null,
            aiLength: profileData?.ai_length as string | null,
            aiCustomInstructions: profileData?.ai_custom_instructions as string | null,
            phone: profileData?.phone as string | null,
            email: profileData?.email as string | null,
            omniRecursivePromptAddon: profileData?.omni_recursive_prompt_addon as string | null,
            repeatVisit,
            openingPatternIdx,
          });
          if (reply) insert.ai_response = reply;
          insert.ai_confidence_score = confidence;
          const escalateBelow = Number(process.env.FORGE_REVIEW_ESCALATE_BELOW ?? '80');
          if (Number.isFinite(escalateBelow) && confidence < escalateBelow) {
            insert.status = 'pending';
            insert.scheduled_at = null;
          }
        } catch {
          insert.ai_response = HUMAN_FALLBACKS.positiveShort;
        }
      } else {
        insert.ai_response = HUMAN_FALLBACKS.positiveShort;
      }
      if (insert.status !== 'pending') {
        insert.status = 'pending_publication'; // Cron publiera quand scheduled_at passé (2h–7h)
      }
    } else {
      insert.status = 'pending';
      insert.whatsapp_sent = false;
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .insert(insert)
      .select('id, status, scheduled_at, ai_response, quick_reply_token')
      .single();

    if (error) {
      return apiJsonError(request, 'serverError', 400);
    }

    safeIngestPlatformReviewWebhook(createAdminClient(), {
      userId: user.id,
      rating: ratingNum,
      comment: comment.trim(),
      reviewId: review.id as string,
      source: src,
      reviewerName: reviewerName.trim(),
      establishmentId: estIdForOmni,
    });

    // Si l'avis est toxique et que le client a accès au bouclier + numéro WhatsApp configuré,
    // on déclenche une alerte immédiate WhatsApp avec le motif précis.
    const hasShield = hasFeature(planSlug, FEATURES.SHIELD_HATEFUL);
    const whatsappPhone = profileData?.whatsapp_phone?.trim();
    if (toxicity.isToxic && hasShield && whatsappPhone) {
      const motif = toxicity.reason || 'Avis toxique détecté';
      const baseUrl = getSiteUrl().replace(/\/+$/, '');
      const actionLink = `${baseUrl}/fr/dashboard/alerts?id=${review.id}`;
      const message =
        `🚨 REPUTEXA : Avis toxique intercepté (${motif}). Dossier de suppression prêt. Validez en 1 clic ici : ${actionLink}`;
      try {
        await sendWhatsAppMessage(whatsappPhone, message);
      } catch {
        // On ne bloque pas la création de l'avis si WhatsApp échoue
      }
    } else if (!isPositive && ratingNum < alertThreshold && hasFeature(planSlug, FEATURES.WHATSAPP_ALERTS)) {
      // Alerte avis négatif — réservée Pulse / Zenith (numéro WhatsApp requis côté client)
      const origin =
        request.headers.get('x-forwarded-proto') && request.headers.get('x-forwarded-host')
          ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('x-forwarded-host')}`
          : getSiteUrl();
      const cookie = request.headers.get('cookie') ?? '';
      try {
        await fetch(`${origin}/api/notify/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ reviewId: review.id }),
        });
      } catch {
        // Continue même si WhatsApp échoue
      }
    }

    return NextResponse.json({
      id: review.id,
      status: review.status,
      scheduled_at: review.scheduled_at,
      ai_response: review.ai_response,
      quick_reply_token: review.quick_reply_token,
    });
  } catch {
    return apiJsonError(request, 'serverError', 500);
  }
}
