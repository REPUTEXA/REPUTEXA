import type { SupabaseClient } from '@supabase/supabase-js';

export type AccountSignal = {
  kind: 'tool_failure' | 'queue_failure';
  label: string;
  detail: string;
  occurredAt: string;
};

function hoursAgo(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 36e5;
}

function formatRelativeFr(iso: string): string {
  const h = hoursAgo(iso);
  if (h < 1 / 60) return "à l'instant";
  if (h < 1) return `il y a ${Math.max(1, Math.round(h * 60))} minute(s)`;
  if (h < 48) return `il y a ${Math.round(h)} heure(s)`;
  return `il y a ${Math.round(h / 24)} jour(s)`;
}

/**
 * Derniers signaux « erreur » liés au compte (échecs outil support, file Zenith).
 * Filtrés par fraîcheur pour le préchargement à l’ouverture du chat.
 */
export async function collectUserAccountSignals(
  admin: SupabaseClient,
  userId: string,
  opts?: { maxSignals?: number; maxAgeHours?: number }
): Promise<{ signals: AccountSignal[]; markdown: string }> {
  const maxSignals = opts?.maxSignals ?? 5;
  const maxAgeHours = opts?.maxAgeHours ?? 72;

  const signals: AccountSignal[] = [];

  const { data: toolRows } = await admin
    .from('tool_call_log')
    .select('tool_name, created_at')
    .eq('user_id', userId)
    .eq('success', false)
    .order('created_at', { ascending: false })
    .limit(maxSignals);

  for (const row of toolRows ?? []) {
    const at = String(row.created_at ?? '');
    if (hoursAgo(at) > maxAgeHours) continue;
    signals.push({
      kind: 'tool_failure',
      label: 'Automatisation support',
      detail: `L’outil « ${String(row.tool_name)} » a échoué lors d’une session récente.`,
      occurredAt: at,
    });
  }

  const { data: queueRows } = await admin
    .from('review_queue')
    .select('status, metadata, updated_at, created_at')
    .eq('user_id', userId)
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(maxSignals);

  for (const row of queueRows ?? []) {
    const at = String(row.updated_at ?? row.created_at ?? '');
    if (hoursAgo(at) > maxAgeHours) continue;
    const meta = row.metadata as Record<string, unknown> | null;
    const err =
      (typeof meta?.error === 'string' && meta.error) ||
      (typeof meta?.last_error === 'string' && meta.last_error) ||
      (typeof meta?.failure_reason === 'string' && meta.failure_reason) ||
      'échec d’envoi ou de traitement';
    signals.push({
      kind: 'queue_failure',
      label: 'File d’avis (Zenith)',
      detail: String(err).slice(0, 400),
      occurredAt: at,
    });
  }

  signals.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const trimmed = signals.slice(0, maxSignals);

  if (trimmed.length === 0) {
    return { signals: [], markdown: '' };
  }

  const lines = trimmed.map(
    (s, i) =>
      `${i + 1}. [${s.kind}] ${s.label} — ${formatRelativeFr(s.occurredAt)} (${s.occurredAt}) : ${s.detail}`
  );
  const markdown =
    '### Signaux récents sur ce compte (pré-chargés — ne pas mentionner « log » ni « base de données » au client)\n\n' +
    lines.join('\n');

  return { signals: trimmed, markdown };
}
