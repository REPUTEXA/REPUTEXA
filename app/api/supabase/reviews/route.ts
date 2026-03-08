import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { calculateScheduledAt, isPositiveReview, generateQuickReplyToken } from '@/lib/reviews/queue';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_PROMPT_BASE = `Tu es un expert en e-réputation. Génère une réponse professionnelle et chaleureuse pour l'avis client.
Détecte la langue de l'avis et réponds dans la MÊME langue. Une seule réponse, pas de JSON.`;

function buildSeoInstruction(keywords: string[]): string {
  if (!keywords.length) return '';
  const list = keywords.slice(0, 10).map((k) => `"${k}"`).join(', ');
  return `\n\nUtilise intelligemment et de manière naturelle un ou deux des mots-clés suivants dans la réponse pour améliorer le référencement local : [${list}]. La phrase doit rester humaine et pas robotique.`;
}

/**
 * Liste les avis de l'utilisateur connecté.
 * Inclut seoKeywords du profil pour afficher le badge Boosté sur le dashboard.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [reviewsRes, profileRes] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, reviewer_name, rating, comment, source, response_text, status, scheduled_at, ai_response, whatsapp_sent, quick_reply_token')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
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
 * - Positif (>= 4 étoiles) → scheduled, ai_response générée, scheduled_at calculé
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
      .select('alert_threshold_stars, seo_keywords, subscription_plan, selected_plan, establishment_name')
      .eq('id', user.id)
      .single();

    const alertThreshold = profileData?.alert_threshold_stars ?? 3;
    const planSlug = toPlanSlug(profileData?.subscription_plan ?? null, profileData?.selected_plan ?? null);
    const seoKeywords = Array.isArray(profileData?.seo_keywords)
      ? profileData.seo_keywords.filter((k): k is string => typeof k === 'string').slice(0, 10)
      : [];
    const useSeo = hasFeature(planSlug, FEATURES.SEO_BOOST) && seoKeywords.length > 0;
    const aiPrompt = AI_PROMPT_BASE + (useSeo ? buildSeoInstruction(seoKeywords) : '');
    const isPositive = isPositiveReview(ratingNum);
    const token = generateQuickReplyToken();

    const insert: Record<string, unknown> = {
      user_id: user.id,
      reviewer_name: reviewerName.trim(),
      rating: ratingNum,
      comment: comment.trim(),
      source: src,
      quick_reply_token: token,
    };

    if (isPositive) {
      insert.status = 'generating';
      insert.scheduled_at = calculateScheduledAt().toISOString();

      if (process.env.OPENAI_API_KEY) {
        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: aiPrompt },
              {
                role: 'user',
                content: `Avis: "${comment.trim()}" | Note: ${ratingNum}/5 | Établissement: ${profileData?.establishment_name || 'client'}. Génère une réponse.`,
              },
            ],
          });
          const content = completion.choices[0]?.message?.content?.trim();
          if (content) {
            insert.ai_response = content;
          }
        } catch {
          insert.ai_response = 'Merci pour votre avis ! Nous sommes ravis de votre retour.';
        }
      } else {
        insert.ai_response = 'Merci pour votre avis ! Nous sommes ravis de votre retour.';
      }
      insert.status = 'scheduled';
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

    if (!isPositive && ratingNum < alertThreshold) {
      const origin = request.headers.get('x-forwarded-proto') && request.headers.get('x-forwarded-host')
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
