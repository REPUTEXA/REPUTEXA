import type { SupabaseClient } from '@supabase/supabase-js';

const WINDOW_SEC = 60;

/**
 * Après insertion d’un ticket caisse : cherche un passage Wallet (earn_points / earn_stamps)
 * sur le même terminal_id dans ±60 s par rapport à ticket_at, et renseigne matched_member_id.
 */
export async function reconcileCashIngestWithWalletScan(
  admin: SupabaseClient,
  merchantId: string,
  params: {
    cashIngestionId: string;
    terminalId: string;
    ticketAtMs: number;
  }
): Promise<void> {
  const { cashIngestionId, terminalId, ticketAtMs } = params;
  if (!terminalId.trim()) return;

  const fromMs = ticketAtMs - WINDOW_SEC * 1000;
  const toMs = ticketAtMs + WINDOW_SEC * 1000;
  const fromIso = new Date(fromMs).toISOString();
  const toIso = new Date(toMs).toISOString();

  const { data: rows, error } = await admin
    .from('banano_loyalty_events')
    .select('id, member_id, created_at')
    .eq('user_id', merchantId)
    .eq('terminal_id', terminalId)
    .in('event_type', ['earn_points', 'earn_stamps'])
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: true })
    .limit(25);

  if (error || !rows?.length) {
    if (error) {
      console.warn('[reconcile-cash-ingest]', error.message);
    }
    return;
  }

  let best: { member_id: string; diff: number } | null = null;
  for (const r of rows) {
    const mid = (r as { member_id?: string }).member_id;
    const ca = (r as { created_at?: string }).created_at;
    if (!mid || !ca) continue;
    const t = new Date(ca).getTime();
    if (Number.isNaN(t)) continue;
    const diff = Math.abs(t - ticketAtMs);
    if (!best || diff < best.diff) {
      best = { member_id: mid, diff };
    }
  }

  if (!best) return;

  const { error: upErr } = await admin
    .from('banano_cash_ingestions')
    .update({ matched_member_id: best.member_id })
    .eq('id', cashIngestionId)
    .eq('merchant_id', merchantId)
    .is('matched_member_id', null);

  if (upErr) {
    console.warn('[reconcile-cash-ingest] update', upErr.message);
  }
}
