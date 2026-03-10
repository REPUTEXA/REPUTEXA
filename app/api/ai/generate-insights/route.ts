import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { hasFeature, FEATURES, toPlanSlug } from '@/lib/feature-gate';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [{ data: profile }, { data: reviews }] = await Promise.all([
      supabase
        .from('profiles')
        .select('subscription_plan, selected_plan, establishment_name')
        .eq('id', user.id)
        .single(),
      supabase
        .from('reviews')
        .select('comment, rating, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    if (!hasFeature(planSlug, FEATURES.SEO_BOOST)) {
      // On réserve pour Pulse / Zenith (features avancées)
      return NextResponse.json({ error: 'Feature not available for this plan' }, { status: 403 });
    }

    const list = (reviews ?? []).map((r) => {
      const when =
        typeof r.created_at === 'string' && r.created_at
          ? r.created_at
          : new Date().toISOString();
      return `- (${when}) [${r.rating}/5] ${r.comment}`;
    });

    if (!list.length) {
      return NextResponse.json({ insights: [] });
    }

    const prompt = [
      "Tu es le directeur stratégique IA pour un restaurant.",
      "À partir de la liste d'avis clients ci-dessous, identifie 3 axes d'amélioration majeurs.",
      '',
      'Pour chacun des 3 axes, renvoie un objet JSON avec :',
      '- "problem": une phrase courte décrivant le problème (ex: "Bruit en terrasse le week-end").',
      '- "solution": une action concrète que le restaurateur peut mettre en place, en lien avec REPUTEXA si pertinent.',
      '- "impact": une phrase sur l\'impact attendu (ex: "+0.2 sur la note globale en 3 semaines").',
      '',
      'Réponds UNIQUEMENT en JSON valide de la forme :',
      '{"insights":[{"problem":"...","solution":"...","impact":"..."},...]}',
      '',
      'Avis :',
      list.join('\n'),
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Tu es un consultant stratégique pour restaurants.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(content) as {
      insights?: { problem?: string; solution?: string; impact?: string }[];
    };
    const safeInsights =
      parsed.insights
        ?.map((i) => ({
          problem: String(i.problem ?? '').trim(),
          solution: String(i.solution ?? '').trim(),
          impact: String(i.impact ?? '').trim(),
        }))
        .filter((i) => i.problem && i.solution && i.impact)
        .slice(0, 3) ?? [];

    return NextResponse.json({ insights: safeInsights });
  } catch (error) {
    console.error('[ai/generate-insights]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generate failed' },
      { status: 500 },
    );
  }
}

