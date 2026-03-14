import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { toPlanSlug, hasFeature, FEATURES } from '@/lib/feature-gate';
import { getSiteUrl } from '@/lib/site-url';
import { startOfWeek, subWeeks, format } from 'date-fns';
import { fr } from 'date-fns/locale';

const CRON_SECRET = process.env.CRON_SECRET;
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
  reviews: { rating: number; comment: string; source: string }[],
  establishmentName: string,
  weekLabel: string
): Promise<WeeklyInsightPayload> {
  const joined = reviews
    .map((r) => `[${r.rating}/5] (${r.source}) ${r.comment}`)
    .join('\n---\n')
    .slice(0, 12000);

  const prompt = `Tu es consultant senior e-réputation pour cabinets premium. VOUVOIEMENT exclusif. Ton Consultant de Luxe.

Règles :
- Pas de généralités. Donnez des faits : "Le mot-clé 'Salade César' revient 4 fois, connotation positive."
- Corrélez : "Le mot 'Attente' corrélé aux avis samedi soir."
- Signaux faibles : "Le personnel semble sous tension le weekend" si des indices le suggèrent.
- Conseils ultra-concrets et actionnables (ex: "Décalez le shift de 19h à 18h30 pour absorber le pic du samedi").

Réponds UNIQUEMENT en JSON :
{
  "topSection": "Ce qui a fait gagner des points (phrases courtes, données précises)",
  "watchSection": "Signaux faibles à surveiller",
  "adviceSection": "UNE action concrète prioritaire (nommée, mesurable)",
  "fullReport": "Rapport détaillé LONG en 3-5 paragraphes, style consultant : analyse sémantique approfondie, corrélations, recommandations chiffrées. Cette version sera affichée dans le dashboard.",
  "trendSeverity": 0-100
}

Établissement : ${establishmentName}
Semaine : ${weekLabel}

Avis :
"""
${joined}
"""`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'JSON valide uniquement. Analyse sémantique profonde.' },
      { role: 'user', content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    topSection: String(parsed.topSection ?? ''),
    watchSection: String(parsed.watchSection ?? ''),
    adviceSection: String(parsed.adviceSection ?? ''),
    fullReport: String(parsed.fullReport ?? ''),
    trendSeverity: Math.min(100, Math.max(0, Number(parsed.trendSeverity) || 0)),
  };
}

function buildGroupComparisonLine(
  byEst: { name: string; avg: number; count: number }[]
): string {
  if (byEst.length < 2) return '';
  const sorted = [...byEst].sort((a, b) => b.avg - a.avg);
  const top = sorted[0];
  const rest = sorted.slice(1);
  const parts = [`🏆 ${top.name} ${top.avg.toFixed(1)}/5`];
  if (rest.length > 0) {
    parts.push(rest.map((e) => `${e.name} ${e.avg.toFixed(1)}`).join(' · '));
  }
  return '📊 Comparaison: ' + parts.join(' | ');
}

function buildWhatsAppMessage(
  weekLabel: string,
  avgRating: number,
  totalReviews: number,
  payload: WeeklyInsightPayload,
  dashboardUrl: string,
  groupComparisonLine?: string
): string {
  const top = (payload.topSection || '').slice(0, 120).trim();
  const watch = (payload.watchSection || '').slice(0, 100).trim();
  const advice = (payload.adviceSection || '').slice(0, 150).trim();
  const blocks = [
    '📈 *REPUTEXA* — ' + weekLabel,
    `⭐ ${avgRating.toFixed(1)}/5 · ${totalReviews} avis`,
    groupComparisonLine || '',
    top ? `✅ ${top}${top.length >= 120 ? '…' : ''}` : '',
    watch ? `⚠️ ${watch}${watch.length >= 100 ? '…' : ''}` : '',
    advice ? `💡 ${advice}${advice.length >= 150 ? '…' : ''}` : '',
    '',
    `→ Rapport complet : ${dashboardUrl}`,
  ].filter(Boolean);
  return blocks.join('\n');
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 });

  const { from, to } = getLastWeekBounds();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const weekStart = format(from, 'yyyy-MM-dd');
  const weekLabel = `${format(from, 'd MMM', { locale: fr })} - ${format(to, 'd MMM yyyy', { locale: fr })}`;
  const baseUrl = getSiteUrl().replace(/\/+$/, '');
  const dashboardUrl = `${baseUrl}/fr/dashboard/statistics?tab=weekly`;

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, establishment_name, whatsapp_phone, subscription_plan, selected_plan')
    .not('whatsapp_phone', 'is', null);

  const results: { userId: string; sent: boolean; error?: string }[] = [];

  for (const profile of profiles ?? []) {
    const phone = (profile.whatsapp_phone as string)?.trim();
    if (!phone) continue;

    const planSlug = toPlanSlug(
      profile.subscription_plan as string | null,
      profile.selected_plan as string | null
    );
    if (!hasFeature(planSlug, FEATURES.REPORTING_WHATSAPP_RECAP)) continue;

    const userId = profile.id as string;
    const establishmentName = (profile.establishment_name as string) ?? 'Établissement';

    const { data: establishments } = await admin
      .from('establishments')
      .select('id, name')
      .eq('user_id', userId);

    const { data: reviews } = await admin
      .from('reviews')
      .select('rating, comment, source, establishment_id')
      .eq('user_id', userId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    const list = (reviews ?? []) as { rating: number; comment: string; source: string; establishment_id?: string | null }[];
    if (list.length < 3) continue;

    const avgRating =
      list.reduce((s, r) => s + (typeof r.rating === 'number' ? r.rating : 0), 0) / list.length;

    const byEstId = new Map<string | null, { sum: number; count: number }>();
    for (const r of list) {
      const key = r.establishment_id ?? null;
      const cur = byEstId.get(key) ?? { sum: 0, count: 0 };
      cur.sum += typeof r.rating === 'number' ? r.rating : 0;
      cur.count += 1;
      byEstId.set(key, cur);
    }
    const estMap = new Map<string, string>(
      (establishments ?? []).map((e) => [e.id, e.name || 'Sans nom'])
    );
    const groupByEst: { name: string; avg: number; count: number; id: string }[] = [];
    const principalData = byEstId.get(null);
    if (principalData && principalData.count > 0) {
      groupByEst.push({
        name: establishmentName,
        avg: principalData.sum / principalData.count,
        count: principalData.count,
        id: 'profile',
      });
    }
    for (const [eid, data] of Array.from(byEstId.entries())) {
      if (eid && data.count > 0) {
        groupByEst.push({
          name: estMap.get(eid) ?? eid.slice(0, 8),
          avg: data.sum / data.count,
          count: data.count,
          id: eid,
        });
      }
    }
    const groupComparisonLine = buildGroupComparisonLine(groupByEst);

    const establishmentNeedingAttention =
      groupByEst.length > 0
        ? [...groupByEst].sort((a, b) => a.avg - b.avg)[0]?.id
        : null;
    const whatsAppDashboardUrl =
      establishmentNeedingAttention
        ? `${baseUrl}/fr/dashboard/statistics?tab=weekly&location=${encodeURIComponent(establishmentNeedingAttention)}`
        : dashboardUrl;

    try {
      // 1) Insight agrégé (tous les avis) → WhatsApp + dashboard principal
      const payload = await generateWeeklyInsight(list, establishmentName, weekLabel);
      await admin.from('weekly_insights').upsert(
        {
          user_id: userId,
          week_start: weekStart,
          establishment_id: null,
          establishment_name: establishmentName,
          avg_rating: Math.round(avgRating * 100) / 100,
          total_reviews: list.length,
          top_section: payload.topSection,
          watch_section: payload.watchSection,
          advice_section: payload.adviceSection,
          full_report_json: { fullReport: payload.fullReport, weekLabel },
          trend_severity: payload.trendSeverity,
          whatsapp_sent_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' }
      );

      // 2) Insights par établissement addon (dashboard filtre)
      for (const est of groupByEst) {
        if (est.id === 'profile') continue; // principal déjà géré ci‑dessus
        const estReviews = list.filter((r) => (r.establishment_id ?? null) === (est.id === 'profile' ? null : est.id));
        if (estReviews.length < 2) continue;
        const estName = est.name;
        const estAvg = est.avg;
        const estPayload = await generateWeeklyInsight(estReviews, estName, weekLabel);
        await admin.from('weekly_insights').upsert(
          {
            user_id: userId,
            week_start: weekStart,
            establishment_id: est.id,
            establishment_name: estName,
            avg_rating: Math.round(estAvg * 100) / 100,
            total_reviews: estReviews.length,
            top_section: estPayload.topSection,
            watch_section: estPayload.watchSection,
            advice_section: estPayload.adviceSection,
            full_report_json: { fullReport: estPayload.fullReport, weekLabel },
            trend_severity: estPayload.trendSeverity,
            whatsapp_sent_at: null,
          },
          { onConflict: 'user_id,week_start,establishment_id' }
        );
      }

      const body = buildWhatsAppMessage(
        weekLabel,
        avgRating,
        list.length,
        payload,
        whatsAppDashboardUrl,
        groupComparisonLine
      );
      const result = await sendWhatsAppMessage(phone, body);
      results.push({ userId, sent: result.success, error: result.error });
    } catch (e) {
      results.push({
        userId,
        sent: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({ ok: true, results }, { status: 200 });
}
