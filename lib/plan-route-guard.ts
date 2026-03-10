import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { checkPlan, toPlanSlug, type PlanSlug } from '@/lib/feature-gate';

/**
 * Redirige vers /pricing si le plan de l'utilisateur est insuffisant.
 * À appeler depuis les layouts ou pages serveur des routes protégées.
 */
export async function requirePlanForRoute(
  requiredPlan: PlanSlug,
  locale: string = 'fr'
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, selected_plan')
    .eq('id', user.id)
    .single();

  const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
  if (!checkPlan(planSlug, requiredPlan)) {
    redirect(`/${locale}/pricing?error=plan_required`);
  }
}
