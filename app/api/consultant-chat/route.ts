/**
 * Chat Consultant Stratégique — Zenith uniquement.
 * L'IA a accès aux avis récents et aux conclusions des rapports hebdo/mensuels.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CONSULTANT_SYSTEM = `Tu es le consultant stratégique e-réputation premium de REPUTEXA. RÈGLES OBLIGATOIRES :
- VOUVOIEMENT exclusif. Ton Consultant de Luxe : expert, distingué, orienté résultats.
- Conseils ultra-concrets : chiffres précis, actions nommées (ex: "Postez 2 stories Instagram/semaine"), jamais de généralités.
- Tu réponds sur la base du contexte fourni (avis clients, rapports hebdo et mensuels). Si le contexte ne permet pas de répondre, propose des pistes sans inventer de données.`;

function buildContextBlock(
  establishmentName: string,
  reviews: { rating: number; comment: string; source: string }[],
  weeklyInsights: { top_section: string | null; watch_section: string | null; advice_section: string | null; full_report_json: unknown }[],
  monthlyReports: { summary_stats: unknown; month: number; year: number }[]
): string {
  const parts: string[] = [`Établissement : ${establishmentName || 'Non renseigné'}`];

  if (reviews.length > 0) {
    parts.push('\n## Derniers avis clients (échantillon)');
    parts.push(
      reviews
        .slice(0, 40)
        .map((r) => `[${r.rating}/5] ${r.source} — ${(r.comment || '').slice(0, 200)}`)
        .join('\n')
    );
  }

  if (weeklyInsights.length > 0) {
    parts.push('\n## Conclusions des rapports hebdomadaires');
    weeklyInsights.slice(0, 4).forEach((w) => {
      if (w.top_section) parts.push(`- Top : ${w.top_section}`);
      if (w.watch_section) parts.push(`- À surveiller : ${w.watch_section}`);
      if (w.advice_section) parts.push(`- Conseil : ${w.advice_section}`);
      const full = (w.full_report_json as { fullReport?: string })?.fullReport;
      if (full) parts.push(`  Rapport détaillé : ${full.slice(0, 400)}...`);
    });
  }

  if (monthlyReports.length > 0) {
    parts.push('\n## Conclusions des rapports mensuels');
    monthlyReports.slice(0, 2).forEach((m) => {
      const stats = m.summary_stats as Record<string, unknown> | null;
      if (stats) {
        if (stats.strength) parts.push(`- Point fort : ${stats.strength}`);
        if (stats.opportunity) parts.push(`- Opportunité : ${stats.opportunity}`);
        if (Array.isArray(stats.actionPlan) && stats.actionPlan.length)
          parts.push(`- Plan d'action : ${(stats.actionPlan as string[]).join(' ; ')}`);
      }
      parts.push(`  (${m.month}/${m.year})`);
    });
  }

  return parts.join('\n');
}

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
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
    if (!hasFeature(planSlug, FEATURES.CONSULTANT_CHAT)) {
      return NextResponse.json({ error: 'Plan ZENITH requis' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    const establishmentName = (profile?.establishment_name as string) ?? '';

    const [
      { data: reviews },
      { data: weeklyInsights },
      { data: monthlyReports },
    ] = await Promise.all([
      supabase
        .from('reviews')
        .select('rating, comment, source')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('weekly_insights')
        .select('top_section, watch_section, advice_section, full_report_json')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(4),
      supabase
        .from('monthly_reports')
        .select('summary_stats, month, year')
        .eq('user_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(2),
    ]);

    const contextBlock = buildContextBlock(
      establishmentName,
      (reviews ?? []).map((r) => ({
        rating: r.rating ?? 0,
        comment: String(r.comment ?? ''),
        source: String(r.source ?? ''),
      })),
      weeklyInsights ?? [],
      monthlyReports ?? []
    );

    const systemContent = `${CONSULTANT_SYSTEM}\n\n## Contexte client\n${contextBlock}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemContent },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      max_tokens: 800,
      temperature: 0.4,
    });

    const content = completion.choices[0]?.message?.content ?? 'Je suis désolé, une erreur est survenue.';
    return NextResponse.json({ message: content });
  } catch (error) {
    console.error('[api/consultant-chat]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
