import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireFeature } from '@/lib/api-plan-guard';
import { FEATURES } from '@/lib/feature-gate';
import { hasFeature, toPlanSlug } from '@/lib/feature-gate';
import { analyzePrivateFeedback } from '@/lib/suggestions/analyze-private-feedback';

/**
 * GET /api/zenith-capture/growth-stats
 * Stats + analyse IA des retours clients (private_feedback).
 */
export async function GET() {
  const planCheck = await requireFeature(FEATURES.AI_CAPTURE);
  if (planCheck instanceof NextResponse) return planCheck;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, selected_plan')
      .eq('id', userId)
      .single();
    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    const hasZenith = hasFeature(planSlug, FEATURES.AI_CAPTURE);

    const [
      { count: contactCount },
      { count: optInCount },
      { data: feedbacks },
    ] = await Promise.all([
      supabase
        .from('contact_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('whatsapp_capture_session')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('opted_in', true),
      supabase
        .from('private_feedback')
        .select('id, feedback_text, classification, resolved, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const sessionsOptedIn = optInCount ?? 0;
    const sollicitations = contactCount ?? 0;
    const optInRate = sollicitations > 0
      ? Math.round((sessionsOptedIn / sollicitations) * 100)
      : 0;

    const unresolved = (feedbacks ?? []).filter((f) => !f.resolved);
    const byClassification: Record<string, number> = {};
    (feedbacks ?? []).forEach((f) => {
      const c = (f.classification as string) || 'autre';
      byClassification[c] = (byClassification[c] ?? 0) + 1;
    });

    let themes: Array<{
      theme: string;
      title: string;
      count: number;
      sentiment: string;
      feedbackIds: string[];
      category: string;
    }> = [];
    let priorityAdvice: string | null = null;

    const inferCategory = (theme: string, title: string): string => {
      const t = (theme + title).toLowerCase();
      if (/service|rapidité|attente|équipe|personnel|accueil/i.test(t)) return 'service';
      if (/dessert|plat|cuisine|nourriture|menu|qualité|prix|hygiène|végétarien/i.test(t)) return 'cuisine';
      if (/ambiance|sonore|musique|lieu|espace|terrasse|décor/i.test(t)) return 'lieu';
      return 'autre';
    };

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

    return NextResponse.json({
      sollicitations,
      optInCount: sessionsOptedIn,
      optInRate,
      privateFeedbacks: feedbacks ?? [],
      byClassification,
      themes,
      priorityAdvice,
      hasZenith,
    });
  } catch (e) {
    console.error('[zenith-capture/growth-stats]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
