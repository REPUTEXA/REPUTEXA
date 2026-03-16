import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { calculateScheduledAt, isPositiveReview, generateQuickReplyToken } from '@/lib/reviews/queue';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import {
  HUMAN_CHARTER_BASE,
  buildZenithSeoInstruction,
  HUMAN_FALLBACKS,
} from '@/lib/ai/concierge-prompts';
import { runZenithTripleJudge } from '@/lib/ai/zenith-triple-judge';
import { getActiveLocationIdFromCookie } from '@/lib/active-location-cookie';
import { validateEstablishmentId } from '@/lib/validate-establishment';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_PROMPT_BASE = `Tu es un expert en e-réputation. Génère une réponse organique et chaleureuse pour l'avis client.
${HUMAN_CHARTER_BASE}
{LANGUE_RULE}
Une seule réponse, pas de JSON.`;

const DEFAULT_STYLE = 'Ton professionnel et bienveillant. Longueur équilibrée (2 à 4 phrases). Vouvoiement.';

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
 * - Positif (>= 4 étoiles) → pending_publication, ai_response générée, scheduled_at 2h–8h, cron publie
 * - Négatif (< 4 étoiles) → pending, envoi alerte WhatsApp
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
      return NextResponse.json(
        { error: 'reviewerName, rating et comment requis' },
        { status: 400 }
      );
    }
    const ratingNum = Number(rating);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: 'rating doit être un nombre entre 1 et 5' },
        { status: 400 }
      );
    }

    const src = ['google', 'tripadvisor', 'trustpilot'].includes((source ?? 'google').toLowerCase())
      ? (source ?? 'google').toLowerCase()
      : 'google';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profileData } = await supabase
      .from('profiles')
      .select(
        'alert_threshold_stars, seo_keywords, subscription_plan, selected_plan, establishment_name, address, whatsapp_phone, language'
      )
      .eq('id', user.id)
      .single();

    const alertThreshold = profileData?.alert_threshold_stars ?? 3;
    const planSlug = toPlanSlug(profileData?.subscription_plan ?? null, profileData?.selected_plan ?? null);
    const profileLanguage = (profileData?.language as string) ?? 'fr';
    const businessLanguage = profileLanguage;
    const isVision = planSlug === 'vision';
    const languageInstruction = isVision
      ? `Vous devez répondre dans la langue locale de l'établissement (${businessLanguage}). Cependant, pour rester poli, si l'avis du client est dans une autre langue, commencez votre réponse par une courte phrase de bienvenue ou de remerciement dans la langue du client, puis enchaînez le reste de la réponse exclusivement en ${businessLanguage}.`
      : 'Détecte la langue de l\'avis et réponds dans la MÊME langue (natif).';
    const seoKeywords = Array.isArray(profileData?.seo_keywords)
      ? profileData.seo_keywords.filter((k): k is string => typeof k === 'string').slice(0, 10)
      : [];
    const useSeo = hasFeature(planSlug, FEATURES.SEO_BOOST);  // Zenith uniquement
    const establishmentName = profileData?.establishment_name?.trim() || 'établissement';
    const businessContext = [seoKeywords[0], profileData?.address?.trim()].filter(Boolean).join(' à ') || establishmentName;
    const aiPrompt =
      AI_PROMPT_BASE.replace('{LANGUE_RULE}', languageInstruction) +
      (useSeo
        ? buildZenithSeoInstruction(establishmentName, businessContext, seoKeywords)
        : '');
    const isPositive = isPositiveReview(ratingNum);
    const token = generateQuickReplyToken();

    // Détection du caractère toxique de l'avis (haine, doxxing, spam, conflit d'intérêt)
    const platformLabel =
      src === 'google'
        ? 'Google Business Profile'
        : src === 'tripadvisor'
          ? 'TripAdvisor'
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

    if (isPositive && !toxicity.isToxic) {
      insert.status = 'generating';
      insert.scheduled_at = calculateScheduledAt().toISOString();  // 2h–7h human-like delay

      if (process.env.OPENAI_API_KEY) {
        try {
          if (useSeo) {
            const winner = await runZenithTripleJudge(openai, {
              reviewComment: comment.trim(),
              reviewerName: reviewerName.trim(),
              rating: ratingNum,
              establishmentName,
              businessContext,
              seoKeywords,
              styleInstruction: DEFAULT_STYLE,
            });
            if (winner) insert.ai_response = winner;
          } else {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              temperature: 0.8,
              messages: [
                { role: 'system', content: aiPrompt },
                {
                  role: 'user',
                  content: `Avis: "${comment.trim()}" | Client: ${reviewerName.trim()} | Note: ${ratingNum}/5 | Établissement: ${profileData?.establishment_name || 'client'}. Génère une réponse. Réponds UNIQUEMENT avec le texte brut, sans guillemets ni préambule.`,
                },
              ],
            });
            let content = completion.choices[0]?.message?.content?.trim() ?? '';
            content = content.replace(/^["']|["']$/g, '').replace(/^Voici la réponse\s*:?\s*/i, '');
            if (content) insert.ai_response = content;
          }
        } catch {
          insert.ai_response = HUMAN_FALLBACKS.positiveShort;
        }
      } else {
        insert.ai_response = HUMAN_FALLBACKS.positiveShort;
      }
      insert.status = 'pending_publication';  // Cron publiera quand scheduled_at passé (2h–7h)
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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
    } else if (!isPositive && ratingNum < alertThreshold) {
      // Comportement historique : alerte simple pour avis très négatif (non toxique)
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Create failed' },
      { status: 500 }
    );
  }
}
