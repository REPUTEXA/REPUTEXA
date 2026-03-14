import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';
import { startOfWeek, subWeeks, format } from 'date-fns';
import { fr } from 'date-fns/locale';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type WeeklyInsightPayload = {
  topSection: string;
  watchSection: string;
  adviceSection: string;
  fullReport: string;
  trendSeverity: number;
};

function getLastWeekBounds(): { from: Date; to: Date } {
  const now = new Date();
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
  lastWeekEnd.setHours(23, 59, 59, 999);
  return { from: lastWeekStart, to: lastWeekEnd };
}

async function generateWeeklyInsight(
  reviews: { rating: number; comment: string; source: string; created_at: string }[],
  establishmentName: string,
  weekLabel: string
): Promise<WeeklyInsightPayload> {
  const joined = reviews
    .map((r) => `[${r.rating}/5] (${r.source}) ${r.comment}`)
    .join('\n---\n')
    .slice(0, 12000);

  const prompt = `Tu es le directeur data e-réputation d'une entreprise niveau Fortune 500. Tu analyses les avis clients d'un établissement pour produire un rapport hebdomadaire ultra-précis.

RÈGLES STRICTES D'ANALYSE SÉMANTIQUE :
- Ne dis JAMAIS "les gens aiment la nourriture" ou des généralités.
- Donne des faits concrets : "Le mot-clé 'Salade César' revient 4 fois avec une connotation positive sur la fraîcheur."
- Corrèle les signaux : "Le mot 'Attente' est corrélé aux avis du samedi soir."
- Détecte les signaux faibles : "Le personnel semble stressé le weekend" si des indices le suggèrent.

Tu dois produire un JSON exactement dans ce format :
{
  "topSection": "Ce qui a fait gagner des points (phrases courtes, données précises)",
  "watchSection": "Signaux faibles ou problèmes récurrents à surveiller",
  "adviceSection": "Une action concrète et rentable (ex: Décalez le shift de 19h à 18h30 pour absorber le pic détecté)",
  "fullReport": "Rapport complet en plusieurs paragraphes, style Fortune 500",
  "trendSeverity": 0-100 (0=aucun problème, 100=alerte critique)
}

Établissement : ${establishmentName}
Semaine analysée : ${weekLabel}

Avis à analyser :
"""
${joined}
"""
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Tu produis UNIQUEMENT du JSON valide. Pas de markdown, pas de commentaire. Analyse sémantique profonde, données concrètes.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    topSection: String(parsed.topSection ?? ''),
    watchSection: String(parsed.watchSection ?? ''),
    adviceSection: String(parsed.adviceSection ?? ''),
    fullReport: String(parsed.fullReport ?? ''),
    trendSeverity: Math.min(100, Math.max(0, Number(parsed.trendSeverity) || 0)),
  };
}

/**
 * GET : génère et retourne l'insight hebdomadaire pour l'utilisateur connecté (Pulse/Zenith).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, selected_plan, establishment_name')
    .eq('id', user.id)
    .single();

  const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
  if (!hasFeature(planSlug, FEATURES.REPORTING_WHATSAPP_RECAP)) {
    return NextResponse.json({ error: 'Feature réservée Pulse/Zenith' }, { status: 403 });
  }

  const { from, to } = getLastWeekBounds();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, comment, source, created_at')
    .eq('user_id', user.id)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false });

  const list = reviews ?? [];
  if (list.length < 3) {
    return NextResponse.json({
      ok: true,
      notEnoughData: true,
      totalReviews: list.length,
      weekLabel: `${format(from, 'd MMM', { locale: fr })} - ${format(to, 'd MMM yyyy', { locale: fr })}`,
    });
  }

  const avgRating =
    list.reduce((s, r) => s + (typeof r.rating === 'number' ? r.rating : 0), 0) / list.length;
  const establishmentName = profile?.establishment_name ?? 'Établissement';
  const weekLabel = `${format(from, 'd MMM', { locale: fr })} - ${format(to, 'd MMM yyyy', { locale: fr })}`;

  let payload: WeeklyInsightPayload;
  try {
    payload = await generateWeeklyInsight(list, establishmentName, weekLabel);
  } catch (e) {
    return NextResponse.json(
      { error: 'Échec analyse IA', detail: e instanceof Error ? e.message : '' },
      { status: 500 }
    );
  }

  const { data: inserted } = await supabase
    .from('weekly_insights')
    .upsert(
      {
        user_id: user.id,
        week_start: format(from, 'yyyy-MM-dd'),
        establishment_name: establishmentName,
        avg_rating: Math.round(avgRating * 100) / 100,
        total_reviews: list.length,
        top_section: payload.topSection,
        watch_section: payload.watchSection,
        advice_section: payload.adviceSection,
        full_report_json: {
          fullReport: payload.fullReport,
          weekLabel,
        },
        trend_severity: payload.trendSeverity,
      },
      { onConflict: 'user_id,week_start' }
    )
    .select('id')
    .single();

  return NextResponse.json({
    ok: true,
    id: inserted?.id,
    weekLabel,
    totalReviews: list.length,
    avgRating: Math.round(avgRating * 100) / 100,
    topSection: payload.topSection,
    watchSection: payload.watchSection,
    adviceSection: payload.adviceSection,
    fullReport: payload.fullReport,
    trendSeverity: payload.trendSeverity,
  });
}
