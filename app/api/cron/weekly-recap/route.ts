import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';

const CRON_SECRET = process.env.CRON_SECRET;
const WEEKLY_RECAP_TO =
  process.env.WEEKLY_RECAP_WHATSAPP_TO ?? process.env.TWILIO_WHATSAPP_NUMBER ?? '';

type SupportedLocale = 'fr' | 'en';

async function loadMessages(locale: SupportedLocale) {
  try {
    const mod = await import(`../../../messages/${locale}.json`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (mod as any).default ?? mod;
  } catch {
    return null;
  }
}

async function getPreferredLocaleForWeeklyRecap(): Promise<SupportedLocale> {
  if (!WEEKLY_RECAP_TO) return 'fr';
  const admin = createAdminClient();
  if (!admin) return 'fr';

  try {
    const normalized = WEEKLY_RECAP_TO.replace(/\D/g, '');
    const { data, error } = await admin
      .from('profiles')
      .select('preferred_language, whatsapp_phone')
      .ilike('whatsapp_phone', `%${normalized.slice(-9)}%`)
      .limit(1)
      .maybeSingle();

    if (error || !data) return 'fr';
    const lang = (data.preferred_language as string | null) ?? 'fr';
    return (['fr', 'en'] as SupportedLocale[]).includes(lang as SupportedLocale)
      ? (lang as SupportedLocale)
      : 'fr';
  } catch {
    return 'fr';
  }
}

async function canSendWeeklyRecapForTarget(): Promise<boolean> {
  if (!WEEKLY_RECAP_TO) return false;
  const admin = createAdminClient();
  if (!admin) return false;

  try {
    const normalized = WEEKLY_RECAP_TO.replace(/\D/g, '');
    const { data, error } = await admin
      .from('profiles')
      .select('subscription_plan, selected_plan, whatsapp_phone')
      .ilike('whatsapp_phone', `%${normalized.slice(-9)}%`)
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;

    const subscriptionPlan = (data.subscription_plan as string | null) ?? null;
    const selectedPlan = (data.selected_plan as string | null) ?? null;
    const planSlug = toPlanSlug(subscriptionPlan, selectedPlan);

    return hasFeature(planSlug, FEATURES.REPORTING_WHATSAPP_RECAP);
  } catch {
    return false;
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  try {
    const reviews = await prisma.review.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        rating: true,
        reviewText: true,
        establishmentName: true,
        city: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200,
    });

    if (!reviews.length) {
      return NextResponse.json(
        { ok: true, message: 'No reviews in the last 7 days' },
        { status: 200 }
      );
    }

    const totalReviews = reviews.length;
    const averageRating =
      reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / Math.max(totalReviews, 1);

    const joinedReviews = reviews
      .map((r) => {
        const place = [r.establishmentName, r.city].filter(Boolean).join(' - ');
        return `(${r.rating}/5) ${place ? `[${place}] ` : ''}${r.reviewText}`;
      })
      .join('\n---\n')
      .slice(0, 8000);

    const locale = await getPreferredLocaleForWeeklyRecap();
    const messages = await loadMessages(locale);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weeklyRecap = (messages as any)?.Alerts?.whatsapp?.weeklyRecap ?? {};
    const isFr = locale === 'fr';

    let summary =
      weeklyRecap.noData ??
      (isFr
        ? "Pas d'avis suffisants pour générer un récap. Continuez à collecter des retours clients."
        : 'Not enough reviews to generate a recap yet. Keep collecting customer feedback.');

    if (process.env.OPENAI_API_KEY) {
      const titleLabel = isFr ? '📊 Ton Récap Hebdo' : '📊 Your Weekly Recap';
      const statsLabel = isFr ? '⭐ Note moyenne :' : '⭐ Average rating:';
      const reviewsWord = isFr ? 'nouveaux avis' : 'new reviews';
      const topLabel = isFr ? '✅ Le Top :' : '✅ Highlight:';
      const alertLabel = isFr ? '⚠️ À surveiller :' : '⚠️ Watch out:';
      const actionLabel = isFr ? '💡 Conseil IA :' : '💡 AI tip:';
      const closingLine = isFr ? 'Bonne semaine ! 🚀' : 'Have a great week! 🚀';

      const prompt = [
        isFr
          ? "Tu es le directeur e-réputation IA de REPUTEXA. Tu parles au patron d'un établissement."
          : 'You are REPUTEXA’s AI reputation director speaking to a busy owner.',
        '',
        isFr
          ? 'Ta mission : générer un message ULTRA-concis en français, structuré en 5 à 6 lignes MAXIMUM, exactement au format suivant :'
          : 'Your job: generate an ULTRA-concise message in English, structured in 5–6 lines MAXIMUM, in the exact format below:',
        '',
        `1) ${titleLabel} (Dates)`,
        `2) ${statsLabel} ${averageRating.toFixed(1)}/5 (${totalReviews} ${reviewsWord})`,
        `3) ${topLabel} phrase courte sur ce qui plaît / what customers loved`,
        `4) ${alertLabel} phrase courte sur un problème récurrent`,
        `5) ${actionLabel} recommandation concrète, actionnable en une phrase`,
        `6) ${closingLine}`,
        '',
        isFr
          ? "Contraintes STRICTES :\n- Utilise EXACTEMENT ces 5 à 6 lignes dans cet ordre.\n- Ne change PAS les emojis ni les labels (📊, ⭐, ✅, ⚠️, 💡).\n- Ligne 2 DOIT utiliser exactement la note moyenne fournie et le nombre d'avis.\n- Lignes 3 à 5 : une seule phrase très courte chacune (pas de puces supplémentaires).\n- Ligne 6 : garde exactement la phrase de clôture.\n- Ne rajoute AUCUNE ligne avant ou après, pas de commentaire, pas d'explication."
          : 'STRICT rules:\n- Use EXACTLY these 5–6 lines in this order.\n- Do NOT change the emojis or labels (📊, ⭐, ✅, ⚠️, 💡).\n- Line 2 MUST use exactly the provided average rating and review count.\n- Lines 3–5: one very short sentence each (no extra bullets).\n- Line 6: keep the closing line exactly as given.\n- Do NOT add any extra lines before or after, no commentary, no explanation.',
        '',
        isFr
          ? "Contexte pour t'aider à formuler (avis récents, un par ligne) :"
          : 'Context to help you write (recent reviews, one per line):',
        joinedReviews,
      ].join('\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: isFr
              ? "Tu aides un patron de restaurant à piloter sa réputation en ligne. Tes réponses sont ultra-concises, orientées action, jamais verbeuses."
              : 'You help a restaurant owner manage their online reputation. Your answers are ultra-concise, action-oriented, never verbose.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 320,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (content) {
        summary = content;
      }
    }

    if (!WEEKLY_RECAP_TO) {
      return NextResponse.json(
        {
          ok: true,
          message:
            weeklyRecap.notConfigured ??
            (locale === 'fr'
              ? "Récap hebdomadaire généré mais destinataire WhatsApp non configuré."
              : 'Weekly recap generated but WhatsApp recipient is not configured.'),
          stats: {
            totalReviews,
            averageRating,
          },
          summary,
        },
        { status: 200 }
      );
    }

    const canSend = await canSendWeeklyRecapForTarget();
    if (!canSend) {
      return NextResponse.json(
        {
          ok: true,
          sent: false,
          stats: {
            totalReviews,
            averageRating,
          },
          summary,
          message: isFr
            ? 'Ce numéro n’a pas accès au récap WhatsApp hebdomadaire (plan Pulse ou Zenith requis).'
            : 'This number does not have access to the weekly WhatsApp recap (Pulse or Zenith plan required).',
        },
        { status: 200 }
      );
    }

    const title =
      weeklyRecap.title ??
      (locale === 'fr' ? '📊 Ton Récap Hebdo' : '📊 Your Weekly Recap');
    const lineTemplate =
      weeklyRecap.line ??
      (locale === 'fr'
        ? '⭐ Note moyenne : {rating}/5 ({count} avis)'
        : '⭐ Average rating: {rating}/5 ({count} reviews)');
    const line = lineTemplate
      .replace('{rating}', averageRating.toFixed(1))
      .replace('{count}', String(totalReviews));

    const bodyLines = [title, line, '', summary];

    const body = bodyLines.join('\n');

    const result = await sendWhatsAppMessage(WEEKLY_RECAP_TO, body);

    return NextResponse.json(
      {
        ok: true,
        sent: result.success,
        stats: {
          totalReviews,
          averageRating,
        },
        error: result.success ? undefined : result.error,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Weekly recap failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

