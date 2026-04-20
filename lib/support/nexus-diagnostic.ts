import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountSignal } from '@/lib/support/user-account-signals';
import { collectUserAccountSignals } from '@/lib/support/user-account-signals';
import type { HealthIntelRow } from '@/lib/support/health-intelligence';
import { fetchActiveHealthIntelligence } from '@/lib/support/health-intelligence';
import { loadForgeKnowledgeBlock } from '@/lib/ai/forge-knowledge-hook';

/** Fait vérifiable exposé au client / audit. */
export type NexusFact = {
  claim: string;
  source: string;
  observed_at?: string;
};

/** Limite de savoir explicite (pas d'invention). */
export type NexusDoubt = {
  topic: string;
  reason: string;
};

export type NexusSuggestedAction = {
  action_key: string;
  label: string;
  /** Outil agent correspondant si applicable (exécution soumise à approbation). */
  tool_name?: string;
  requires_human_approval: boolean;
  rationale: string;
};

/**
 * Enveloppe obligatoire du pré-scan / diagnostic Nexus.
 */
export type NexusDiagnosticEnvelope = {
  FACTS: NexusFact[];
  DOUBTS: NexusDoubt[];
  SUGGESTED_ACTION: NexusSuggestedAction | null;
  /** 0–100, heuristique (clarté des signaux + complétude des lectures). */
  confidence_score: number;
  /** 0–100, urgence admin (signaux d’échec, paiement, intégrations) — tri Nexus Live. */
  gravity_score: number;
};

type ProfileSnap = {
  subscription_plan: string | null;
  subscription_status: string | null;
  payment_status: string | null;
  webhook_token: string | null;
  api_key: string | null;
};

/** Heuristique déterministe au bootstrap (alignée sur les mêmes lectures que le diagnostic). */
export function computeTicketGravityScore(params: {
  profile: ProfileSnap | null;
  signals: AccountSignal[];
  healthRows: HealthIntelRow[];
}): number {
  let g = 12;
  const qf = params.signals.filter((s) => s.kind === 'queue_failure').length;
  const tf = params.signals.filter((s) => s.kind === 'tool_failure').length;
  g += Math.min(qf, 3) * 26;
  g += Math.min(tf, 2) * 16;
  if (params.profile) {
    const pay = String(params.profile.payment_status ?? '').trim().toLowerCase();
    const paymentSeemsOk = !pay || ['ok', 'paid', 'active', 'trialing', 'none'].includes(pay);
    if (!paymentSeemsOk) g += 22;
    if (!String(params.profile.webhook_token ?? '').trim()) g += 16;
    if (!String(params.profile.api_key ?? '').trim()) g += 10;
  } else {
    g += 20;
  }
  g += Math.min(params.healthRows.length, 3) * 7;
  return Math.max(0, Math.min(100, Math.round(g)));
}

export async function buildNexusBootstrapDiagnostic(params: {
  admin: SupabaseClient;
  userId: string;
}): Promise<NexusDiagnosticEnvelope> {
  const { admin, userId } = params;

  const { data: profile } = (await admin
    .from('profiles')
    .select('subscription_plan, subscription_status, payment_status, webhook_token, api_key')
    .eq('id', userId)
    .maybeSingle()) as { data: ProfileSnap | null };

  const { signals } = await collectUserAccountSignals(admin, userId, {
    maxSignals: 8,
    maxAgeHours: 72,
  });
  const { rows: healthRows } = await fetchActiveHealthIntelligence(admin);

  const FACTS: NexusFact[] = [];
  const DOUBTS: NexusDoubt[] = [];

  if (profile) {
    FACTS.push({
      claim: `Plan d’abonnement renseigné : ${profile.subscription_plan ?? '—'}.`,
      source: 'profiles.subscription_plan',
    });
    FACTS.push({
      claim: `Statut abonnement : ${profile.subscription_status ?? '—'}.`,
      source: 'profiles.subscription_status',
    });
    FACTS.push({
      claim: `Statut paiement côté fiche : ${profile.payment_status ?? 'ok'}.`,
      source: 'profiles.payment_status',
    });
    const hasTok = Boolean(profile.webhook_token && String(profile.webhook_token).trim());
    FACTS.push({
      claim: hasTok
        ? 'Jeton d’automatisation Zenith présent sur le profil.'
        : 'Aucun jeton d’automatisation Zenith enregistré sur le profil.',
      source: 'profiles.webhook_token',
    });
    const hasKey = Boolean(profile.api_key && String(profile.api_key).trim());
    FACTS.push({
      claim: hasKey
        ? 'Clé d’intégration webhook (rtx_…) présente sur le profil.'
        : 'Clé d’intégration webhook absente sur le profil.',
      source: 'profiles.api_key',
    });
  } else {
    DOUBTS.push({
      topic: 'Fiche profil',
      reason: 'Profil introuvable pour cet identifiant — impossible de valider abonnement ou intégrations.',
    });
  }

  for (const s of signals) {
    FACTS.push({
      claim: `${s.label} : ${s.detail}`,
      source: s.kind === 'queue_failure' ? 'review_queue' : 'tool_call_log',
      observed_at: s.occurredAt,
    });
  }

  for (const h of healthRows) {
    FACTS.push({
      claim: `Incident plateforme actif « ${h.title} » (${h.status}) : ${h.customer_summary}`,
      source: `system_health_intelligence:${h.slug}`,
    });
  }

  if (signals.length === 0) {
    DOUBTS.push({
      topic: 'Symptôme exact',
      reason:
        'Aucun échec récent pré-chargé sur la file ou les outils — la plainte du client peut préciser un autre périmètre.',
    });
  }

  let SUGGESTED_ACTION: NexusSuggestedAction | null = null;
  const queueFailures = signals.filter((s) => s.kind === 'queue_failure');
  const toolFailures = signals.filter((s) => s.kind === 'tool_failure');
  const webhookWeak = profile && !profile.webhook_token?.trim();

  if (queueFailures.length > 0 || toolFailures.some((t) => /restart_webhook|webhook/i.test(t.detail)) || webhookWeak) {
    SUGGESTED_ACTION = {
      action_key: 'reconnect_zenith_webhook',
      label: 'Réinitialiser le jeton Zenith (automatisation caisse)',
      tool_name: 'restart_webhook',
      requires_human_approval: true,
      rationale:
        'Signaux d’échec file ou outil liés à l’automatisation, ou absence de jeton : une reconnexion est une piste factuelle à proposer après validation humaine.',
    };
  } else if (toolFailures.length > 0) {
    SUGGESTED_ACTION = {
      action_key: 'review_tool_failures',
      label: 'Analyser les échecs d’outils récents avec le client',
      requires_human_approval: false,
      rationale:
        'Échecs d’outils enregistrés sans file d’avis en échec : privilégier l’investigation guidée avant toute écriture.',
    };
  }

  let confidence_score = 72;
  if (profile) confidence_score += 8;
  if (signals.length === 0) confidence_score += 10;
  confidence_score -= Math.min(36, signals.length * 12);
  if (healthRows.length > 0) confidence_score -= 4;
  confidence_score = Math.max(15, Math.min(96, Math.round(confidence_score)));

  const gravity_score = computeTicketGravityScore({
    profile,
    signals,
    healthRows,
  });

  try {
    const forgeBlob = await loadForgeKnowledgeBlock({
      agentKeys: ['nexus', 'sentinel', 'reputexa_core'],
      queryHint: signals.map((s) => s.detail).join(' ').slice(0, 500),
      maxSnippets: 8,
    });
    const condensed = forgeBlob.replace(/\s+/g, ' ').trim();
    if (condensed.length > 20) {
      FACTS.push({
        claim: `Mémoire Forge — consignes / correctifs connus : ${condensed.slice(0, 2200)}`,
        source: 'ia_forge',
      });
    }
  } catch {
    /* Forge optionnelle */
  }

  return {
    FACTS,
    DOUBTS,
    SUGGESTED_ACTION,
    confidence_score,
    gravity_score,
  };
}
