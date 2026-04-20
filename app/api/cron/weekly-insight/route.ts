import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { toPlanSlug, hasFeature, FEATURES } from '@/lib/feature-gate';
import { getSiteUrl } from '@/lib/site-url';
import { startOfWeek, subWeeks, format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

const CRON_SECRET = process.env.CRON_SECRET;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type WeeklyInsightPayload = {
  topSection: string;
  watchSection: string;
  adviceSection: string;
  fullReport: string;
  trendSeverity: number;
  /** Shadow reporting : hook WhatsApp « action de la semaine », ton consultant + 1 emoji max */
  shadowWhatsApp: string;
};

type CronLang = 'fr' | 'en';

function getLastWeekBounds(): { from: Date; to: Date } {
  const now = new Date();
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
  lastWeekEnd.setHours(23, 59, 59, 999);
  return { from: lastWeekStart, to: lastWeekEnd };
}

function emptyWeekPayload(
  establishmentName: string,
  weekLabel: string,
  lang: CronLang
): WeeklyInsightPayload {
  if (lang === 'en') {
    return {
      topSection: 'No new reviews this week.',
      watchSection: 'As soon as guests post feedback, this recap will fill in automatically.',
      adviceSection:
        'For the week ahead, make it easy to leave a review (QR, short link, friendly desk prompt).',
      fullReport: `Period: ${weekLabel}. Venue: ${establishmentName}. No reviews were received in this window. Treat this as a marker: the goal is to restart review capture to fuel upcoming analysis.`,
      trendSeverity: 0,
      shadowWhatsApp:
        'Quiet week on reviews — make leaving feedback frictionless (QR at checkout) so we can coach you with data next Monday.',
    };
  }
  return {
    topSection: 'Aucun nouvel avis sur cette semaine.',
    watchSection: 'Dès que les clients publient des retours, ce récap s’enrichira automatiquement.',
    adviceSection:
      'Mettez en avant une façon simple de laisser un avis (QR, lien court, rappel en caisse) pour la semaine à venir.',
    fullReport: `Période : ${weekLabel}. Établissement : ${establishmentName}. Aucun avis n’a été reçu sur l’intervalle. Ce rapport sert de marqueur : l’objectif est de relancer la collecte d’avis pour alimenter les prochaines analyses.`,
    trendSeverity: 0,
    shadowWhatsApp:
      'Semaine calme côté avis — penser QR en caisse ou petit mot sympathique pour déclencher les retours.',
  };
}

async function generateWeeklyInsight(
  reviews: { rating: number; comment: string; source: string }[],
  establishmentName: string,
  weekLabel: string,
  lang: CronLang
): Promise<WeeklyInsightPayload> {
  if (reviews.length === 0) {
    return emptyWeekPayload(establishmentName, weekLabel, lang);
  }

  const joined = reviews
    .map((r) => `[${r.rating}/5] (${r.source}) ${r.comment}`)
    .join('\n---\n')
    .slice(0, 12000);

  const scarceFr =
    reviews.length < 3
      ? `\nIMPORTANT : seulement ${reviews.length} avis — reste prudent, qualifie l’analyse (« premiers signaux », « à confirmer »), pas d’affirmations larges.`
      : '';

  const scarceEn =
    reviews.length < 3
      ? `\nIMPORTANT: only ${reviews.length} reviews — stay cautious, qualify the analysis ("early signals", "to be confirmed"), no sweeping claims.`
      : '';

  const prompt =
    lang === 'en'
      ? `You are a senior e-reputation consultant for premium firms. Formal professional tone throughout.

Rules:
- No fluff. State facts: "The phrase 'Caesar salad' appears 4 times, positive lean."
- Correlate: "'Wait time' clusters with Saturday-night reviews."
- Weak signals only when evidence supports them.
- One crisp, measurable action for the week (name it, e.g. "Shift briefing 18:15 Sat–Sun").
${scarceEn}

Reply ONLY in JSON:
{
  "topSection": "What went well (short lines, precise data)",
  "watchSection": "Weak signals to monitor",
  "adviceSection": "ONE priority action of the week (named, measurable)",
  "fullReport": "Long detailed report, 3–5 paragraphs, consultant style: deep semantic read, correlations, quantified angles. Shown in the dashboard.",
  "trendSeverity": 0-100,
  "shadowWhatsApp": "ONE short punchy line for WhatsApp: human consultant tone, max 1 emoji, concrete 'this week' move (Shadow Reporting). No raw stats if already implied. French if venue is FR."
}

Venue: ${establishmentName}
Week: ${weekLabel}

Reviews:
"""
${joined}
"""`
      : `Tu es consultant senior e-réputation pour cabinets premium. VOUVOIEMENT exclusif. Ton Consultant de Luxe.

Règles :
- Pas de généralités. Donnez des faits : "Le mot-clé 'Salade César' revient 4 fois, connotation positive."
- Corrélez : "Le mot 'Attente' corrélé aux avis samedi soir."
- Signaux faibles : "Le personnel semble sous tension le weekend" si des indices le suggèrent.
- Conseils ultra-concrets et actionnables (ex: "Décalez le shift de 19h à 18h30 pour absorber le pic du samedi").
${scarceFr}

Réponds UNIQUEMENT en JSON :
{
  "topSection": "Ce qui a fait gagner des points (phrases courtes, données précises)",
  "watchSection": "Signaux faibles à surveiller",
  "adviceSection": "UNE action concrète prioritaire de la semaine (nommée, mesurable)",
  "fullReport": "Rapport détaillé LONG en 3-5 paragraphes, style consultant : analyse sémantique approfondie, corrélations, recommandations chiffrées. Cette version sera affichée dans le dashboard.",
  "trendSeverity": 0-100,
  "shadowWhatsApp": "UNE phrase courte façon SMS consultant parfait : ton direct et humain, 1 emoji max, action concrète « cette semaine » (Shadow Reporting). Pas de chiffres bruts si déjà dans le récap."
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
      {
        role: 'system',
        content:
          lang === 'en'
            ? 'Valid JSON only. Deep semantic analysis.'
            : 'JSON valide uniquement. Analyse sémantique profonde.',
      },
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
    shadowWhatsApp: String(parsed.shadowWhatsApp ?? '').trim() || String(parsed.adviceSection ?? '').slice(0, 200),
  };
}

function buildGroupComparisonLine(
  byEst: { name: string; avg: number; count: number }[],
  lang: CronLang
): string {
  if (byEst.length < 2) return '';
  const sorted = [...byEst].sort((a, b) => b.avg - a.avg);
  const top = sorted[0];
  const rest = sorted.slice(1);
  const parts = [`🏆 ${top.name} ${top.avg.toFixed(1)}/5`];
  if (rest.length > 0) {
    parts.push(rest.map((e) => `${e.name} ${e.avg.toFixed(1)}`).join(' · '));
  }
  const prefix = lang === 'en' ? '📊 Comparison: ' : '📊 Comparaison: ';
  return prefix + parts.join(' | ');
}

function firstNameFromFullName(fullName: string | null | undefined): string {
  const n = (fullName ?? '').trim();
  if (!n) return '';
  return n.split(/\s+/)[0] ?? '';
}

function buildWhatsAppMessage(
  weekLabel: string,
  avgRating: number,
  totalReviews: number,
  payload: WeeklyInsightPayload,
  dashboardUrl: string,
  lang: CronLang,
  groupComparisonLine?: string,
  ownerFirstName?: string
): string {
  const top = (payload.topSection || '').slice(0, 200).trim();
  const watch = (payload.watchSection || '').slice(0, 200).trim();
  const advice = (payload.adviceSection || '').slice(0, 220).trim();
  const shadow = (payload.shadowWhatsApp || '').slice(0, 300).trim();
  const statsLine =
    lang === 'en'
      ? totalReviews === 0
        ? '⭐ No reviews this week — full detail is in your workspace.'
        : `⭐ Average rating: ${avgRating.toFixed(1)}/5 · ${totalReviews} reviews this week`
      : totalReviews === 0
        ? '⭐ Aucun avis sur la semaine — le détail reste dans votre espace.'
        : `⭐ Note moyenne : ${avgRating.toFixed(1)}/5 · ${totalReviews} avis cette semaine`;

  const greetEn = ownerFirstName ? `Hi ${ownerFirstName}! ` : '';
  const greetFr = ownerFirstName ? `Bonjour ${ownerFirstName} — ` : '';

  const blocks =
    lang === 'en'
      ? [
          `${greetEn}📊 *REPUTEXA weekly recap*`,
          `Week: ${weekLabel}`,
          statsLine,
          groupComparisonLine || '',
          '',
          top ? `✅ *What went well*\n${top}${top.length >= 200 ? '…' : ''}` : '',
          watch ? `⚠️ *Watch / negative drift*\n${watch}${watch.length >= 200 ? '…' : ''}` : '',
          advice ? `🎯 *Action of the week*\n${advice}${advice.length >= 220 ? '…' : ''}` : '',
          shadow ? `💡 *Your move*\n${shadow}${shadow.length >= 300 ? '…' : ''}` : '',
          '',
          `📎 Full history + archive:`,
          dashboardUrl,
        ]
      : [
          `${greetFr}📊 *Récap hebdomadaire REPUTEXA*`,
          `Semaine : ${weekLabel}`,
          statsLine,
          groupComparisonLine || '',
          '',
          top ? `✅ *Ce qui va bien*\n${top}${top.length >= 200 ? '…' : ''}` : '',
          watch ? `⚠️ *À surveiller / ressenti négatif*\n${watch}${watch.length >= 200 ? '…' : ''}` : '',
          advice ? `🎯 *Action de la semaine*\n${advice}${advice.length >= 220 ? '…' : ''}` : '',
          shadow ? `💡 *Conseil flash*\n${shadow}${shadow.length >= 300 ? '…' : ''}` : '',
          '',
          `📎 Historique détaillé + archives :`,
          dashboardUrl,
        ];
  return blocks.filter(Boolean).join('\n');
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ta = apiAdminT();
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: ta('supabaseAdminMissing') }, { status: 500 });

  const { from, to } = getLastWeekBounds();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const weekStart = format(from, 'yyyy-MM-dd');
  const baseUrl = getSiteUrl().replace(/\/+$/, '');

  const { data: profiles } = await admin
    .from('profiles')
    .select(
      'id, establishment_name, full_name, whatsapp_phone, subscription_plan, selected_plan, preferred_language'
    )
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
    const ownerFirstName = firstNameFromFullName(profile.full_name as string | null | undefined);

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

    const avgRating =
      list.length === 0
        ? 0
        : list.reduce((s, r) => s + (typeof r.rating === 'number' ? r.rating : 0), 0) / list.length;

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

    const establishmentNeedingAttention =
      groupByEst.length > 0
        ? [...groupByEst].sort((a, b) => a.avg - b.avg)[0]?.id
        : null;
    const loc =
      (profile.preferred_language as string)?.toLowerCase().startsWith('en') ? 'en' : 'fr';
    const cronLang: CronLang = loc === 'en' ? 'en' : 'fr';
    const weekLabel =
      cronLang === 'en'
        ? `${format(from, 'd MMM', { locale: enUS })} - ${format(to, 'd MMM yyyy', { locale: enUS })}`
        : `${format(from, 'd MMM', { locale: fr })} - ${format(to, 'd MMM yyyy', { locale: fr })}`;
    const groupComparisonLine = buildGroupComparisonLine(groupByEst, cronLang);
    const locQuery = establishmentNeedingAttention
      ? `tab=weekly&location=${encodeURIComponent(establishmentNeedingAttention)}#weekly`
      : `tab=weekly#weekly`;
    const whatsAppDashboardUrl = `${baseUrl}/${loc}/dashboard/statistics?${locQuery}`;

    try {
      // 1) Insight agrégé (tous les avis) → WhatsApp + dashboard principal
      const payload = await generateWeeklyInsight(list, establishmentName, weekLabel, cronLang);
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
        if (estReviews.length < 1) continue;
        const estName = est.name;
        const estAvg = est.avg;
        const estPayload = await generateWeeklyInsight(estReviews, estName, weekLabel, cronLang);
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
        cronLang,
        groupComparisonLine,
        ownerFirstName
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
