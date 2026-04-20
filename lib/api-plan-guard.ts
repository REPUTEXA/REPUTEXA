import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasFeature, toPlanSlug, type FeatureKey, type PlanSlug } from '@/lib/feature-gate';

export async function getProfilePlan(): Promise<{ userId: string; selectedPlan: PlanSlug } | NextResponse> {
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

  const selectedPlan = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);

  return { userId: user.id, selectedPlan };
}

/**
 * Vérifie l'accès à une fonctionnalité. Retourne NextResponse 403 si non autorisé.
 */
export async function requireFeature(feature: FeatureKey): Promise<{ userId: string; selectedPlan: PlanSlug } | NextResponse> {
  const result = await getProfilePlan();
  if (result instanceof NextResponse) return result;
  if (!hasFeature(result.selectedPlan, feature)) {
    return NextResponse.json(
      { error: 'Plan Upgrade Required', code: 'PLAN_UPGRADE_REQUIRED' },
      { status: 403 }
    );
  }
  return result;
}
