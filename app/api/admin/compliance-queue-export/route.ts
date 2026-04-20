/**
 * GET /api/admin/compliance-queue-export
 * Traceability export for review — whole platform or one merchant (special case).
 *
 * Query:
 *   format=json|csv (default json)
 *   days=1..365 (default = queue retention window, currently 120)
 *   dataset=queue|consent — required for csv
 *   merchant_id=<uuid> — optional: restricts queue + consents to that merchant account
 *   include_message_bodies=true|1 — optional (admin): adds archived WhatsApp text (metadata.outbound_whatsapp_body)
 *     to JSON and queue CSV; sensitive data, off by default.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { ZENITH_AUDIT_EXPORT_DEFAULT_DAYS } from '@/lib/zenith-capture/policy';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 15_000;
const MS_DAY = 24 * 60 * 60 * 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function maskPhone(phone: string): string {
  const compact = (phone ?? '').replace(/\s/g, '');
  if (compact.length <= 5) return '•••••';
  return `${compact.slice(0, 4)}…${compact.slice(-2)}`;
}

function ingressFromMeta(metadata: Record<string, unknown> | null): string {
  const v = metadata?.ingress;
  if (v === 'api_key') return 'api_key';
  if (v === 'zenith_token') return 'zenith_token';
  return '';
}

function parseMerchantId(searchParams: URLSearchParams): string | null | 'invalid' {
  const raw = searchParams.get('merchant_id')?.trim() ?? '';
  if (!raw) return null;
  if (!UUID_RE.test(raw)) return 'invalid';
  return raw;
}

function merchantFileSuffix(merchantId: string | null): string {
  return merchantId ? `-merchant-${merchantId.slice(0, 8)}` : '';
}

function parseIncludeMessageBodies(searchParams: URLSearchParams): boolean {
  const v = (searchParams.get('include_message_bodies') ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function outboundWhatsappBody(meta: Record<string, unknown> | null): string | null {
  const v = meta?.outbound_whatsapp_body;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export async function GET(request: Request) {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') === 'csv' ? 'csv' : 'json';
  let days = parseInt(searchParams.get('days') ?? String(ZENITH_AUDIT_EXPORT_DEFAULT_DAYS), 10);
  if (Number.isNaN(days) || days < 1) days = ZENITH_AUDIT_EXPORT_DEFAULT_DAYS;
  if (days > 365) days = 365;

  const merchantParsed = parseMerchantId(searchParams);
  if (merchantParsed === 'invalid') {
    return NextResponse.json(
      { error: ta('complianceMerchantIdInvalid') },
      { status: 400 }
    );
  }
  const merchantId = merchantParsed;
  const includeMessageBodies = parseIncludeMessageBodies(searchParams);
  const bodiesSuffix = includeMessageBodies ? '-message-bodies' : '';

  const datasetParam = searchParams.get('dataset');
  const csvDataset =
    datasetParam === 'consent' ? 'consent' : datasetParam === 'queue' ? 'queue' : null;

  const since = new Date(Date.now() - days * MS_DAY).toISOString();
  const dateSlug = new Date().toISOString().slice(0, 10);
  const merchantPart = merchantFileSuffix(merchantId);
  const queueFileSuffix = `${merchantPart}${bodiesSuffix}`;

  try {
    if (format === 'csv') {
      if (csvDataset !== 'queue' && csvDataset !== 'consent') {
        return NextResponse.json(
          { error: ta('complianceCsvDatasetRequired') },
          { status: 400 }
        );
      }

      if (csvDataset === 'queue') {
        let q = admin
          .from('review_queue')
          .select('id, user_id, first_name, phone, source_info, status, scheduled_at, created_at, sent_at, metadata')
          .gte('created_at', since);
        if (merchantId) q = q.eq('user_id', merchantId);
        const { data: rows, error: qErr } = await q
          .order('created_at', { ascending: false })
          .limit(MAX_LIMIT);

        if (qErr) throw new Error(qErr.message);

        const list = rows ?? [];
        const userIds = Array.from(new Set(list.map((r) => r.user_id as string)));
        const nameByUser = new Map<string, string | null>();
        if (userIds.length > 0) {
          const { data: profs } = await admin
            .from('profiles')
            .select('id, establishment_name')
            .in('id', userIds);
          for (const p of profs ?? []) {
            nameByUser.set(p.id as string, (p.establishment_name as string | null) ?? null);
          }
        }

        const headerCols = [
          'queue_id',
          'merchant_id',
          'merchant_name',
          'received_at',
          'ingress',
          'status',
          'created_at',
          'scheduled_at',
          'sent_at',
          'source_info',
          'phone_masked',
          'caller_ip',
          'outbound_message_recorded',
          ...(includeMessageBodies ? ['outbound_whatsapp_body'] : []),
        ];
        const header = headerCols.join(',');

        const lines = list.map((r) => {
          const meta = (r.metadata ?? null) as Record<string, unknown> | null;
          const received =
            (typeof meta?.received_at === 'string' && meta.received_at) || (r.created_at as string);
          const ingress = ingressFromMeta(meta) || 'unknown';
          const caller = typeof meta?.caller_ip === 'string' ? meta.caller_ip : '';
          const body = outboundWhatsappBody(meta);
          const hasBody = Boolean(body);
          const src = (r.source_info as string | null) ?? '';
          const row = [
            csvEscape(r.id as string),
            csvEscape(r.user_id as string),
            csvEscape((nameByUser.get(r.user_id as string) ?? '').trim()),
            csvEscape(received),
            csvEscape(ingress),
            csvEscape(r.status as string),
            csvEscape(r.created_at as string),
            csvEscape(r.scheduled_at as string),
            csvEscape((r.sent_at as string | null) ?? ''),
            csvEscape(src),
            csvEscape(maskPhone((r.phone as string) ?? '')),
            csvEscape(caller),
            csvEscape(hasBody ? 'yes' : 'no'),
          ];
          if (includeMessageBodies) {
            row.push(csvEscape(body ?? ''));
          }
          return row.join(',');
        });

        const csv = [header, ...lines].join('\r\n');
        const filename = `reputexa-audit-review-queue-${days}d${queueFileSuffix}-${dateSlug}.csv`;

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }

      let cq = admin
        .from('consent_logs')
        .select(
          'id, merchant_id, review_queue_id, phone_hash, consent_type, channel, message_preview, created_at'
        )
        .gte('created_at', since);
      if (merchantId) cq = cq.eq('merchant_id', merchantId);
      const { data: crows, error: cErr } = await cq
        .order('created_at', { ascending: false })
        .limit(MAX_LIMIT);

      if (cErr) throw new Error(cErr.message);

      const list = crows ?? [];
      const merchantIds = Array.from(new Set(list.map((r) => r.merchant_id as string)));
      const merchantName = new Map<string, string | null>();
      if (merchantIds.length > 0) {
        const { data: profs } = await admin
          .from('profiles')
          .select('id, establishment_name')
          .in('id', merchantIds);
        for (const p of profs ?? []) {
          merchantName.set(p.id as string, (p.establishment_name as string | null) ?? null);
        }
      }

      const header = [
        'consent_log_id',
        'merchant_id',
        'merchant_name',
        'created_at',
        'consent_type',
        'channel',
        'review_queue_id',
        'phone_hash',
        'message_preview',
      ].join(',');

      const lines = list.map((r) =>
        [
          csvEscape(r.id as string),
          csvEscape(r.merchant_id as string),
          csvEscape((merchantName.get(r.merchant_id as string) ?? '').trim()),
          csvEscape(r.created_at as string),
          csvEscape(r.consent_type as string),
          csvEscape(r.channel as string),
          csvEscape((r.review_queue_id as string | null) ?? ''),
          csvEscape(r.phone_hash as string),
          csvEscape((r.message_preview as string | null) ?? ''),
        ].join(',')
      );

      const csv = [header, ...lines].join('\r\n');
      const filename = `reputexa-audit-consent-logs-${days}d${merchantPart}-${dateSlug}.csv`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    let qReview = admin
      .from('review_queue')
      .select('id, user_id, first_name, phone, source_info, status, scheduled_at, created_at, sent_at, metadata')
      .gte('created_at', since);
    if (merchantId) qReview = qReview.eq('user_id', merchantId);

    let qConsent = admin
      .from('consent_logs')
      .select(
        'id, merchant_id, review_queue_id, phone_hash, consent_type, channel, message_preview, created_at'
      )
      .gte('created_at', since);
    if (merchantId) qConsent = qConsent.eq('merchant_id', merchantId);

    const [{ data: qrows, error: qErr }, { data: crows, error: cErr }] = await Promise.all([
      qReview.order('created_at', { ascending: false }).limit(MAX_LIMIT),
      qConsent.order('created_at', { ascending: false }).limit(MAX_LIMIT),
    ]);

    if (qErr) throw new Error(qErr.message);
    if (cErr) throw new Error(cErr.message);

    const queueList = qrows ?? [];
    const consentList = crows ?? [];
    const allIds = Array.from(
      new Set([
        ...queueList.map((r) => r.user_id as string),
        ...consentList.map((r) => r.merchant_id as string),
      ])
    );

    const names = new Map<string, string | null>();
    if (allIds.length > 0) {
      const { data: profs } = await admin.from('profiles').select('id, establishment_name').in('id', allIds);
      for (const p of profs ?? []) {
        names.set(p.id as string, (p.establishment_name as string | null) ?? null);
      }
    }

    const queuePayload = queueList.map((r) => {
      const meta = (r.metadata ?? null) as Record<string, unknown> | null;
      const received =
        (typeof meta?.received_at === 'string' && meta.received_at) || (r.created_at as string);
      const body = outboundWhatsappBody(meta);
      const base: Record<string, unknown> = {
        queue_id: r.id,
        merchant_id: r.user_id,
        merchant_name: names.get(r.user_id as string) ?? null,
        first_name: r.first_name,
        phone_masked: maskPhone((r.phone as string) ?? ''),
        source_info: r.source_info,
        status: r.status,
        created_at: r.created_at,
        scheduled_at: r.scheduled_at,
        sent_at: r.sent_at,
        received_at: received,
        ingress: ingressFromMeta(meta) || null,
        caller_ip: typeof meta?.caller_ip === 'string' ? meta.caller_ip : null,
        outbound_message_recorded: Boolean(body),
      };
      if (includeMessageBodies) {
        base.outbound_whatsapp_body = body;
      }
      return base;
    });

    const consentPayload = consentList.map((r) => ({
      id: r.id,
      merchant_id: r.merchant_id,
      merchant_name: names.get(r.merchant_id as string) ?? null,
      review_queue_id: r.review_queue_id,
      phone_hash: r.phone_hash,
      consent_type: r.consent_type,
      channel: r.channel,
      message_preview: r.message_preview,
      created_at: r.created_at,
    }));

    const filename = `reputexa-audit-snapshot-${days}d${queueFileSuffix}-${dateSlug}.json`;

    return NextResponse.json(
      {
        exported_at: new Date().toISOString(),
        period_days: days,
        row_cap: MAX_LIMIT,
        merchant_id_filter: merchantId,
        include_message_bodies: includeMessageBodies,
        review_queue: queuePayload,
        consent_logs: consentPayload,
      },
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      }
    );
  } catch (e) {
    console.error('[admin/compliance-queue-export]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('serverError') },
      { status: 500 }
    );
  }
}
