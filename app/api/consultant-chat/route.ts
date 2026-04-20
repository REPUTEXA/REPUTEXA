/**
 * Chat Consultant Stratégique — Zenith uniquement.
 * L'IA a accès aux avis récents et aux conclusions des rapports hebdo/mensuels.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createClient } from '@/lib/supabase/server';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';
import {
  GROUNDED_FACTS_CHARTER_SNIPPET,
  HUMAN_KEYBOARD_CHARTER_SNIPPET,
  scrubAiTypography,
} from '@/lib/ai/human-keyboard-output';
import { guardAuthenticatedLlmCall } from '@/lib/ai-llm-budget-http';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CONSULTANT_SYSTEM = `Tu es le consultant stratégique e-réputation premium de REPUTEXA. RÈGLES OBLIGATOIRES :
- VOUVOIEMENT exclusif. Ton Consultant de Luxe : expert, distingué, orienté résultats.
- Conseils concrets : cite des chiffres ou volumes uniquement s'ils figurent dans le contexte fourni ; sinon propose des actions nommées sans quantifier inventé (ex. "prévoir des stories régulières" plutôt qu'un chiffre fabriqué).
- Tu réponds sur la base du contexte fourni (avis clients, rapports hebdo et mensuels). Si le contexte ne permet pas de répondre, propose des pistes sans inventer de données.
- Si une vue groupe multi-sites est fournie, tu peux comparer objectivement les établissements et proposer d'aligner les réglages du site le moins performant sur celui qui tire le mieux son épingle du jeu, sans inventer de chiffres absents du contexte.

${HUMAN_KEYBOARD_CHARTER_SNIPPET}

${GROUNDED_FACTS_CHARTER_SNIPPET}`;

async function buildGroupPerformanceSnapshot(
  supabase: SupabaseClient,
  userId: string,
  principalLabel: string
): Promise<string> {
  const since = new Date();
  since.setDate(since.getDate() - 45);
  const { data: rows } = await supabase
    .from('reviews')
    .select('rating, establishment_id')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());
  if (!rows?.length) return '';

  const agg = new Map<string | null, { sum: number; n: number }>();
  for (const r of rows) {
    const k = (r as { establishment_id?: string | null }).establishment_id ?? null;
    const cur = agg.get(k) ?? { sum: 0, n: 0 };
    cur.sum += typeof r.rating === 'number' ? r.rating : 0;
    cur.n += 1;
    agg.set(k, cur);
  }
  const { data: establishments } = await supabase.from('establishments').select('id, name').eq('user_id', userId);
  const nameById = new Map<string, string>((establishments ?? []).map((e) => [e.id, e.name || 'Site']));

  const lines: string[] = ['Synthèse groupe (~45 j, tous sites du compte) :'];
  const main = agg.get(null);
  if (main && main.n > 0) {
    lines.push(`- ${principalLabel || 'Établissement principal'} : ${(main.sum / main.n).toFixed(2)}/5 · ${main.n} avis`);
  }
  for (const [eid, v] of Array.from(agg.entries())) {
    if (eid == null || v.n < 1) continue;
    lines.push(`- ${nameById.get(eid) ?? 'Site'} : ${(v.sum / v.n).toFixed(2)}/5 · ${v.n} avis`);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function buildContextBlock(
  focusLabel: string,
  groupSnapshot: string,
  reviews: { rating: number; comment: string; source: string }[],
  weeklyInsights: { top_section: string | null; watch_section: string | null; advice_section: string | null; full_report_json: unknown }[],
  monthlyReports: { summary_stats: unknown; month: number; year: number }[]
): string {
  const parts: string[] = [
    `Focus sélecteur dashboard : ${focusLabel || 'Non renseigné'}`,
    groupSnapshot ? `\n${groupSnapshot}` : '',
  ].filter(Boolean);

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
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, selected_plan, establishment_name')
      .eq('id', user.id)
      .single();

    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    if (!hasFeature(planSlug, FEATURES.CONSULTANT_CHAT)) {
      return apiJsonError(request, 'consultantChat_planZenithRequired', 403);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const messages = body?.messages;
    const t = createServerTranslator('Api', apiLocaleFromRequest(request));
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: t('errors.invalidMessages') }, { status: 400 });
    }

    const rawLoc = body?.activeEstablishmentId;
    const activeEstablishmentId =
      typeof rawLoc === 'string' && rawLoc.trim().length > 0 ? rawLoc.trim() : 'profile';

    const principalName = (profile?.establishment_name as string) ?? '';

    let focusLabel = principalName || 'Établissement principal';
    if (activeEstablishmentId !== 'profile') {
      const { data: estRow } = await supabase
        .from('establishments')
        .select('name')
        .eq('id', activeEstablishmentId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (estRow?.name) focusLabel = String(estRow.name);
    }

    let reviewsQuery = supabase
      .from('reviews')
      .select('rating, comment, source')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(55);

    if (activeEstablishmentId !== 'profile') {
      reviewsQuery = reviewsQuery.eq('establishment_id', activeEstablishmentId);
    } else {
      reviewsQuery = reviewsQuery.is('establishment_id', null);
    }

    let weeklyQuery = supabase
      .from('weekly_insights')
      .select('top_section, watch_section, advice_section, full_report_json, week_start')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(6);

    if (activeEstablishmentId !== 'profile') {
      weeklyQuery = weeklyQuery.eq('establishment_id', activeEstablishmentId);
    } else {
      weeklyQuery = weeklyQuery.is('establishment_id', null);
    }

    const groupSnapshot = await buildGroupPerformanceSnapshot(supabase, user.id, principalName);

    const [
      { data: reviews },
      { data: weeklyInsights },
      { data: monthlyReports },
    ] = await Promise.all([
      reviewsQuery,
      weeklyQuery,
      supabase
        .from('monthly_reports')
        .select('summary_stats, month, year')
        .eq('user_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(2),
    ]);

    const contextBlock = buildContextBlock(
      focusLabel,
      groupSnapshot,
      (reviews ?? []).map((r) => ({
        rating: r.rating ?? 0,
        comment: String(r.comment ?? ''),
        source: String(r.source ?? ''),
      })),
      weeklyInsights ?? [],
      monthlyReports ?? []
    );

    const systemContent = `${CONSULTANT_SYSTEM}\n\n## Contexte client\n${contextBlock}`;

    const budgetBlock = await guardAuthenticatedLlmCall(user.id);
    if (budgetBlock) return budgetBlock;

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

    const raw =
      completion.choices[0]?.message?.content ?? t('errors.consultantChatLlmFallback');
    const content = scrubAiTypography(raw);
    return NextResponse.json({ message: content });
  } catch (error) {
    console.error('[api/consultant-chat]', error);
    return apiJsonError(request, 'errors.unexpectedError', 500);
  }
}
