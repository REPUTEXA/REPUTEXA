import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { hasFeature, toPlanSlug } from '@/lib/feature-gate';
import { analyzePrivateFeedback } from '@/lib/suggestions/analyze-private-feedback';

/**
 * GET /api/suggestions/private-feedback
 * Retourne les retours private_feedback analysés et regroupés par l'IA.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, selected_plan')
      .eq('id', user.id)
      .single();

    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    const hasZenith = hasFeature(planSlug, 'ai_capture');

    const { data: feedbacks } = await supabase
      .from('private_feedback')
      .select('id, feedback_text, classification, resolved, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const unresolved = (feedbacks ?? []).filter((f) => !f.resolved);
    const resolved = (feedbacks ?? []).filter((f) => f.resolved);

    let themes: Array<{
      theme: string;
      title: string;
      count: number;
      sentiment: string;
      feedbackIds: string[];
      category: string;
    }> = [];
    let priorityAdvice: string | null = null;

    if (unresolved.length > 0 && process.env.OPENAI_API_KEY) {
      const analyzed = await analyzePrivateFeedback(
        unresolved.map((f) => ({
          id: f.id,
          feedback_text: f.feedback_text,
          classification: f.classification,
        }))
      );
      themes = analyzed.themes.map((t) => ({
        ...t,
        category: inferCategory(t.theme, t.title),
      }));
      priorityAdvice = hasZenith ? analyzed.priorityAdvice : null;
    }

    const totalUnresolved = unresolved.length;
    const totalThisMonth = (feedbacks ?? []).filter((f) => {
      const d = new Date(f.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return NextResponse.json({
      themes,
      priorityAdvice,
      totalUnresolved,
      totalThisMonth,
      hasZenith,
      rawFeedbacks: unresolved.slice(0, 50),
      resolvedCount: resolved.length,
    });
  } catch (e) {
    console.error('[suggestions/private-feedback]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

function inferCategory(
  theme: string,
  title: string
): 'service' | 'cuisine' | 'lieu' | 'autre' {
  const t = (theme + title).toLowerCase();
  if (/service|rapidité|attente|équipe|personnel|accueil/i.test(t)) return 'service';
  if (/dessert|plat|cuisine|nourriture|menu|qualité|prix|hygiène|végétarien/i.test(t)) return 'cuisine';
  if (/ambiance|sonore|musique|lieu|espace|terrasse|décor/i.test(t)) return 'lieu';
  return 'autre';
}
