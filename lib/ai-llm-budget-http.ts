import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumeLlmBudgetUnit, maybeThrottleAfterSoftExceeded } from '@/lib/ai-llm-budget';

/**
 * @returns null si l’appel LLM peut continuer, sinon réponse HTTP 429 (ou 503 si config incomplète en prod — ici on laisse passer si pas d’admin).
 */
export async function guardAuthenticatedLlmCall(userId: string): Promise<NextResponse | null> {
  const admin = createAdminClient();
  if (!admin) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[ai_llm_budget] createAdminClient missing in production');
    }
    return null;
  }

  const r = await consumeLlmBudgetUnit(admin, userId);
  if (!r.allowed) {
    return NextResponse.json(
      {
        error: 'Volume d’analyses IA maximal atteint pour aujourd’hui (quota compte).',
        code: 'ai_budget_hard_cap',
        hint:
          'Les plafonds réinitialisent à minuit UTC. Contactez le support pour ajuster votre volume ou découvrir un pack complémentaire.',
        upgradePath: '/fr/pricing',
        hardLimit: r.hardLimit,
        used: r.count,
      },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  await maybeThrottleAfterSoftExceeded(r.softExceeded);
  return null;
}
