import { createAdminClient } from '@/lib/supabase/admin';

export type PerfProbeRow = {
  id: string;
  label: string;
  ms: number;
  ok: boolean;
  /** Si erreur (ex. table absente en dev) : n’inflige pas un échec global */
  optional?: boolean;
  error?: string;
};

export type PerfProbePayload = {
  budget_ms: number;
  checked_at: string;
  probes: PerfProbeRow[];
  burst: { count: number; max_ms: number; ok: boolean };
  all_ok: boolean;
  advice: string[];
};

/**
 * Micro-benchmark côté serveur : requêtes proches du dashboard / Nexus.
 * Ne simule pas 10k clients ; détecte early des lenteurs grossières (index, pooling, cold start).
 */
export async function runAdminPerfProbe(budgetMs = 500): Promise<PerfProbePayload> {
  const advice = [
    'Chaque ligne doit rester sous le budget : au-delà, vérifier index (ex. reviews.created_at, tickets.status+gravity), pooler les connexions côté app, et le plan Supabase.',
    'Les fonctions Vercel peuvent ajouter du cold start : une mesure isolée élevée peut être normale ; des dépassements répétés = creuser.',
    'Pour charge réelle : k6, Artillery, ou Locust contre l’URL staging avec jeu de données volumineux.',
  ];

  const admin = createAdminClient();
  if (!admin) {
    return {
      budget_ms: budgetMs,
      checked_at: new Date().toISOString(),
      probes: [
        {
          id: 'config',
          label: 'Client Supabase (service role)',
          ms: 0,
          ok: false,
          error: 'SUPABASE_SERVICE_ROLE_KEY / client admin absent',
        },
      ],
      burst: { count: 0, max_ms: 0, ok: false },
      all_ok: false,
      advice,
    };
  }

  const probes: PerfProbeRow[] = [];

  async function run(
    id: string,
    label: string,
    fn: () => PromiseLike<{ error?: { message?: string } | null }>,
    optional = false
  ): Promise<void> {
    const t0 = Date.now();
    try {
      const res = await fn();
      const ms = Date.now() - t0;
      const errMsg = res.error?.message;
      if (errMsg) {
        probes.push({
          id,
          label,
          ms,
          ok: optional,
          optional,
          error: errMsg,
        });
        return;
      }
      probes.push({ id, label, ms, ok: ms < budgetMs, optional });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erreur';
      probes.push({
        id,
        label,
        ms: Date.now() - t0,
        ok: optional,
        optional,
        error: msg,
      });
    }
  }

  await run('db_profile_pick', 'Lecture 1 profil', () => admin.from('profiles').select('id').limit(1).maybeSingle());

  await run('db_reviews_feed', 'Derniers avis (tri date)', () =>
    admin.from('reviews').select('id, created_at').order('created_at', { ascending: false }).limit(20)
  );

  await run('db_review_ai_row', 'Avis avec réponse IA (échantillon)', () =>
    admin.from('reviews').select('id').not('ai_response', 'is', null).limit(1).maybeSingle()
  );

  await run(
    'db_tickets_open',
    'Tickets ouverts (aperçu Nexus)',
    () => admin.from('tickets').select('id').eq('status', 'open').limit(25),
    true
  );

  const burstCount = 6;
  const burstLatencies: number[] = [];
  await Promise.all(
    Array.from({ length: burstCount }, async () => {
      const t0 = Date.now();
      try {
        const r = await admin.from('profiles').select('id').limit(1).maybeSingle();
        if (r.error) throw new Error(r.error.message);
        burstLatencies.push(Date.now() - t0);
      } catch {
        burstLatencies.push(Date.now() - t0);
      }
    })
  );
  const burst_max = burstLatencies.length > 0 ? Math.max(...burstLatencies) : 0;
  const burst_ok = burst_max < budgetMs;

  const hardFail = probes.some((p) => !p.optional && (!p.ok || p.error));
  const all_ok = !hardFail && burst_ok;

  return {
    budget_ms: budgetMs,
    checked_at: new Date().toISOString(),
    probes,
    burst: { count: burstCount, max_ms: burst_max, ok: burst_ok },
    all_ok,
    advice,
  };
}
