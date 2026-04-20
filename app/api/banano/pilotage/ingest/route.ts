import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reconcileCashIngestWithWalletScan } from '@/lib/banano/pilotage/reconcile-cash-ingest-wallet';

const RAW_DATA_MAX = 120_000;

function sanitizeTicketRef(raw: string | undefined): string {
  const s = (raw ?? '').trim().slice(0, 200);
  if (!s) return 'ticket';
  const cleaned = s.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned.slice(0, 120) || 'ticket';
}

/**
 * POST /api/banano/pilotage/ingest
 * Auth : Bearer (ou x-banano-pilotage-ingest-key) = profiles.banano_pilotage_ingest_secret
 * Fallback dev : BANANO_PILOTAGE_INGEST_SECRET + BANANO_PILOTAGE_INGEST_MERCHANT_ID
 * Corps : { amount, timestamp, source?, raw_data?, ticket_file_name?, terminal_id?, staff_name? }
 */
export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerKey = req.headers.get('x-banano-pilotage-ingest-key')?.trim() ?? '';
  const token = bearer || headerKey;
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let merchantId: string | null = null;
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('id')
    .eq('banano_pilotage_ingest_secret', token)
    .maybeSingle();

  if (profErr) {
    console.error('[banano/pilotage/ingest] profile lookup', profErr.message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  const row = prof as { id?: string } | null;
  if (row?.id) {
    merchantId = row.id;
  } else {
    const envSecret = process.env.BANANO_PILOTAGE_INGEST_SECRET?.trim();
    const envMerchant = process.env.BANANO_PILOTAGE_INGEST_MERCHANT_ID?.trim();
    if (envSecret && envMerchant && token === envSecret) {
      merchantId = envMerchant;
    }
  }

  if (!merchantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const amount = o.amount;
  const timestamp = o.timestamp;

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }
  if (typeof timestamp !== 'string' || !timestamp.trim()) {
    return NextResponse.json({ error: 'invalid_timestamp' }, { status: 400 });
  }

  const source =
    typeof o.source === 'string' && o.source.trim()
      ? o.source.trim().slice(0, 512)
      : 'reputexa-sync';

  const terminalIdRaw = typeof o.terminal_id === 'string' ? o.terminal_id.trim().slice(0, 64) : '';
  const staffNameRaw = typeof o.staff_name === 'string' ? o.staff_name.trim().slice(0, 200) : '';

  let rawData = '';
  if (typeof o.raw_data === 'string') {
    rawData = o.raw_data.slice(0, RAW_DATA_MAX);
  } else if (o.raw_data != null) {
    try {
      rawData = JSON.stringify(o.raw_data).slice(0, RAW_DATA_MAX);
    } catch {
      rawData = '';
    }
  }

  const ticketFileName =
    typeof o.ticket_file_name === 'string' ? o.ticket_file_name.slice(0, 512) : '';
  let stem = '';
  if (ticketFileName) {
    const base = ticketFileName.replace(/\\/g, '/').split('/').pop() ?? '';
    stem = base.replace(/\.[^.]+$/, '');
  } else if (typeof o.ticket_ref === 'string') {
    stem = o.ticket_ref;
  }
  const ticketRef = sanitizeTicketRef(stem || undefined);

  let ticketAtMs = Date.parse(timestamp.trim());
  if (Number.isNaN(ticketAtMs)) {
    ticketAtMs = Date.now();
  }
  const ticketAtIso = new Date(ticketAtMs).toISOString();

  const { data: insRow, error: insErr } = await admin
    .from('banano_cash_ingestions')
    .insert({
      merchant_id: merchantId,
      amount,
      source,
      raw_data: rawData || `[ingest] ${timestamp.trim()}`,
      terminal_id: terminalIdRaw || null,
      staff_name: staffNameRaw || null,
      ticket_at: ticketAtIso,
    })
    .select('id')
    .maybeSingle();

  if (insErr) {
    console.error('[banano/pilotage/ingest] insert', insErr.message);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  const newId = insRow && typeof (insRow as { id?: string }).id === 'string' ? (insRow as { id: string }).id : null;
  if (newId && terminalIdRaw) {
    await reconcileCashIngestWithWalletScan(admin, merchantId, {
      cashIngestionId: newId,
      terminalId: terminalIdRaw,
      ticketAtMs,
    });
  }

  return NextResponse.json({ ok: true, ticket_ref: ticketRef });
}
